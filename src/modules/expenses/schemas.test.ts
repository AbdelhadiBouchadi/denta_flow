import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { expenseCategory } from "@/database/schema";
import { clinicInstant, toClinicDate } from "@/lib/time";
import { isForbiddenError, retryUnlessDenied } from "./access";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_VALUES,
  EXPENSE_VALIDATION_MESSAGES as M,
} from "./constants";
import { resolveSpentAt, toFormValues } from "./form-values";
import { expenseFormSchema, expenseUpdateSchema } from "./schemas";
import { ExpenseCategory, type ExpenseListItem } from "./types";

const valid = {
  label: "Loyer du cabinet",
  category: ExpenseCategory.Rent,
  amountCents: 800000,
  spentDate: "2026-10-01",
  supplier: "SCI Résidence Souss",
  notes: "",
};

const messages = (input: unknown) => {
  const result = expenseFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

afterEach(() => {
  vi.useRealTimers();
});

describe("category enum", () => {
  it("is in lockstep with the pgEnum", () => {
    expect([...EXPENSE_CATEGORY_VALUES].sort()).toEqual(
      [...expenseCategory.enumValues].sort(),
    );
    expect(Object.values(ExpenseCategory).sort()).toEqual(
      [...expenseCategory.enumValues].sort(),
    );
  });

  it("has a French label for every category", () => {
    for (const value of EXPENSE_CATEGORY_VALUES) {
      expect(EXPENSE_CATEGORY_LABELS[value]).toBeTruthy();
    }
  });

  it("refuses a category outside the enum", () => {
    expect(messages({ ...valid, category: "fuel" })).toEqual([
      M.categoryInvalid,
    ]);
  });
});

describe("expenseFormSchema", () => {
  it("accepts a valid charge", () => {
    expect(messages(valid)).toEqual([]);
  });

  it("requires a positive integer amount in centimes", () => {
    expect(messages({ ...valid, amountCents: null })).toEqual([
      M.amountPositive,
    ]);
    expect(messages({ ...valid, amountCents: 0 })).toEqual([M.amountPositive]);
    expect(messages({ ...valid, amountCents: -5000 })).toEqual([
      M.amountPositive,
    ]);
    expect(messages({ ...valid, amountCents: 12.5 })).toEqual([
      M.amountInvalid,
    ]);
  });

  it("trims the label and refuses a blank one", () => {
    const parsed = expenseFormSchema.parse({ ...valid, label: "  Loyer  " });
    expect(parsed.label).toBe("Loyer");
    expect(messages({ ...valid, label: "   " })).toEqual([M.labelRequired]);
  });

  it("trims supplier and notes, reading blanks as null", () => {
    const parsed = expenseFormSchema.parse({
      ...valid,
      supplier: "  ONEE ",
      notes: "   ",
    });
    expect(parsed.supplier).toBe("ONEE");
    expect(parsed.notes).toBeNull();
  });

  it("refuses a malformed or impossible date", () => {
    expect(messages({ ...valid, spentDate: "01/10/2026" })).toContain(
      M.dateInvalid,
    );
    expect(messages({ ...valid, spentDate: "2026-02-31" })).toContain(
      M.dateInvalid,
    );
  });

  it("accepts today and the past, refuses tomorrow — on the CLINIC calendar", () => {
    vi.useFakeTimers();
    // 23:30 clinic time on 7 October: already the 8th in Tokyo, still the
    // 7th in the clinic. The 7th is today; the 8th is the future.
    vi.setSystemTime(clinicInstant("2026-10-07", "23:30"));
    expect(messages({ ...valid, spentDate: "2026-10-07" })).toEqual([]);
    expect(messages({ ...valid, spentDate: "2025-12-31" })).toEqual([]);
    expect(messages({ ...valid, spentDate: "2026-10-08" })).toEqual([
      M.inFuture,
    ]);
  });

  it("requires the version token on update", () => {
    expect(
      expenseUpdateSchema.safeParse({ ...valid, id: "e1" }).success,
    ).toBe(false);
    expect(
      expenseUpdateSchema.safeParse({
        ...valid,
        id: "e1",
        expectedUpdatedAt: new Date(),
      }).success,
    ).toBe(true);
  });
});

/** The fields `toFormValues` reads from a stored expense. */
const stored = (spentAt: Date) =>
  ({
    ...valid,
    category: "rent",
    supplier: null,
    notes: null,
    spentAt,
  }) as unknown as ExpenseListItem;

/**
 * The clinic-date round trip (decision 3), under two machine zones — Node
 * re-reads `process.env.TZ` when it changes. Built from the clinic calendar,
 * never a written offset: Morocco is UTC+1 in June and UTC+0 from
 * 2026-09-20 (tzdata 2026c), so both regimes are covered.
 */
describe.each(["UTC", "Asia/Tokyo"])("clinic date under TZ=%s", (zone) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  it("runs in the zone it claims", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  });

  for (const day of ["2026-10-01", "2026-06-15", "2026-03-01"]) {
    it(`stores ${day} as clinic midnight and reads it back as ${day}`, () => {
      const spentAt = resolveSpentAt({ spentDate: day });
      expect(spentAt).toEqual(clinicInstant(day));
      expect(toClinicDate(spentAt)).toBe(day);

      // Reopened in edit, then saved untouched: the same instant.
      const values = toFormValues(stored(spentAt));
      expect(values.spentDate).toBe(day);
      expect(resolveSpentAt({ spentDate: values.spentDate })).toEqual(spentAt);
    });
  }

  it("dates a charge created at 00:30 on 1 October clinic time on 1 October", () => {
    vi.useFakeTimers();
    vi.setSystemTime(clinicInstant("2026-10-01", "00:30"));
    const values = toFormValues();
    expect(values.spentDate).toBe("2026-10-01");
    expect(toClinicDate(resolveSpentAt({ spentDate: values.spentDate }))).toBe(
      "2026-10-01",
    );
  });

  it("duplicates a row with today's date, never the copied one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(clinicInstant("2026-10-09", "09:00"));
    const values = toFormValues(undefined, {
      label: "Loyer du cabinet",
      category: "rent",
      amountCents: 800000,
      supplier: "SCI Résidence Souss",
      notes: null,
    });
    expect(values).toMatchObject({
      label: "Loyer du cabinet",
      category: ExpenseCategory.Rent,
      amountCents: 800000,
      spentDate: "2026-10-09",
    });
  });
});

describe("access", () => {
  const trpcError = (code: string) => ({ message: "x", data: { code } });

  it("recognises the procedure's FORBIDDEN", () => {
    expect(isForbiddenError(trpcError("FORBIDDEN"))).toBe(true);
    expect(isForbiddenError(trpcError("INTERNAL_SERVER_ERROR"))).toBe(false);
    expect(isForbiddenError(new Error("redacted"))).toBe(false);
    expect(isForbiddenError(null)).toBe(false);
  });

  it("never retries an authorization answer", () => {
    expect(retryUnlessDenied(0, trpcError("FORBIDDEN"))).toBe(false);
    expect(retryUnlessDenied(0, trpcError("UNAUTHORIZED"))).toBe(false);
    expect(retryUnlessDenied(0, trpcError("INTERNAL_SERVER_ERROR"))).toBe(true);
    expect(retryUnlessDenied(3, new Error("network"))).toBe(false);
  });
});
