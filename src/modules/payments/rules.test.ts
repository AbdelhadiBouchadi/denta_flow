import { describe, expect, it } from "vitest";

import { paymentMethod } from "@/database/schema";
import { BALANCE_LABELS, describeBalance } from "@/lib/format";
import { clinicInstant, toClinicDate, toClinicWallClock } from "@/lib/time";
import { PAYMENT_VALIDATION_MESSAGES as M } from "./constants";
import { resolvePaidAt, toFormValues } from "./form-values";
import {
  advanceExcessCents,
  canEditPayment,
  needsAdvanceConfirmation,
} from "./rules";
import { paymentCreateSchema, paymentFormSchema } from "./schemas";
import { PaymentMethod } from "./types";

const valid = {
  patientId: "p1",
  amountCents: 150000,
  method: PaymentMethod.Cash,
  paidDate: "2026-10-05",
  paidTime: "10:30",
  treatmentId: null,
  insurerId: null,
  reference: "",
  notes: "",
};

const messages = (input: unknown) => {
  const result = paymentFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("paymentFormSchema — amount", () => {
  it("accepts a strictly positive integer of centimes", () => {
    expect(paymentFormSchema.parse({ ...valid, amountCents: 1 }).amountCents).toBe(1);
  });

  it("refuses zero, a negative amount (no refunds in V1) and an empty field", () => {
    expect(messages({ ...valid, amountCents: 0 })).toEqual([M.amountPositive]);
    expect(messages({ ...valid, amountCents: -100 })).toEqual([M.amountPositive]);
    expect(messages({ ...valid, amountCents: null })).toEqual([M.amountPositive]);
  });

  it("refuses a fraction of a centime", () => {
    expect(messages({ ...valid, amountCents: 10.5 })).toEqual([M.amountInvalid]);
  });
});

describe("paymentFormSchema — paidAt", () => {
  it("accepts a past instant and now", () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
    const now = new Date();
    expect(
      paymentFormSchema.safeParse({
        ...valid,
        paidDate: toClinicDate(now),
        paidTime: toClinicWallClock(now),
      }).success,
    ).toBe(true);
  });

  it("refuses a paidAt in the future, read on the clinic's clock", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      messages({
        ...valid,
        paidDate: toClinicDate(tomorrow),
        paidTime: toClinicWallClock(tomorrow),
      }),
    ).toEqual([M.inFuture]);
  });

  it("wants a real day and a time", () => {
    expect(messages({ ...valid, paidDate: "2026-02-31" })).toEqual([M.dateInvalid]);
    expect(messages({ ...valid, paidTime: "" })).toEqual([M.timeRequired]);
  });

  it("resolves the wall clock through the clinic timezone", () => {
    // Asserted as a round-trip, never as an offset: Morocco's offset moves.
    const at = resolvePaidAt({ paidDate: "2026-03-05", paidTime: "09:15" });
    expect(at).toEqual(clinicInstant("2026-03-05", "09:15"));
    expect(toClinicDate(at)).toBe("2026-03-05");
    expect(toClinicWallClock(at)).toBe("09:15");
  });

  it("opens a blank form dated now on the clinic's wall clock", () => {
    const now = new Date("2026-10-07T12:34:00Z");
    const values = toFormValues(undefined, undefined, now);
    expect(values.paidDate).toBe(toClinicDate(now));
    expect(values.paidTime).toBe(toClinicWallClock(now));
    expect(values.method).toBe(PaymentMethod.Cash);
  });
});

describe("paymentFormSchema — insurer", () => {
  it("requires an insurer for «Assurance»", () => {
    expect(messages({ ...valid, method: PaymentMethod.Insurance })).toEqual([
      M.insurerRequired,
    ]);
    expect(
      paymentFormSchema.safeParse({
        ...valid,
        method: PaymentMethod.Insurance,
        insurerId: "i1",
      }).success,
    ).toBe(true);
  });

  it("forbids an insurer on every other method", () => {
    for (const method of [
      PaymentMethod.Cash,
      PaymentMethod.Check,
      PaymentMethod.Card,
      PaymentMethod.Transfer,
    ]) {
      expect(messages({ ...valid, method, insurerId: "i1" })).toEqual([
        M.insurerForbidden,
      ]);
    }
  });

  it("reads empty optional fields as null", () => {
    const parsed = paymentFormSchema.parse({ ...valid, reference: "  " });
    expect(parsed.reference).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.insurerId).toBeNull();
  });

  it("defaults confirmAdvance to false", () => {
    expect(paymentCreateSchema.parse(valid).confirmAdvance).toBe(false);
  });
});

describe("needsAdvanceConfirmation", () => {
  it("settles exactly at zero without asking", () => {
    expect(
      needsAdvanceConfirmation({ remainingCents: 150000, amountCents: 150000 }),
    ).toBe(false);
  });

  it("asks from one centime above what is owed", () => {
    expect(
      needsAdvanceConfirmation({ remainingCents: 150000, amountCents: 150001 }),
    ).toBe(true);
    expect(
      advanceExcessCents({ remainingCents: 150000, amountCents: 150001 }),
    ).toBe(1);
  });

  it("2 000 DH against 1 500 DH owed is a 500 DH advance", () => {
    const write = { remainingCents: 150000, amountCents: 200000 };
    expect(needsAdvanceConfirmation(write)).toBe(true);
    expect(advanceExcessCents(write)).toBe(50000);
  });

  it("asks again when the patient is already in credit, reporting this payment only", () => {
    const write = { remainingCents: -50000, amountCents: 10000 };
    expect(needsAdvanceConfirmation(write)).toBe(true);
    expect(advanceExcessCents(write)).toBe(10000);
  });

  it("counts the stored amount out of the balance on update", () => {
    // Owed 1 000 DH after a 500 DH payment: raising it to 1 500 DH settles.
    expect(
      needsAdvanceConfirmation({
        remainingCents: 100000,
        previousAmountCents: 50000,
        amountCents: 150000,
      }),
    ).toBe(false);
    expect(
      needsAdvanceConfirmation({
        remainingCents: 100000,
        previousAmountCents: 50000,
        amountCents: 150001,
      }),
    ).toBe(true);
  });

  it("never asks when an edit does not raise the amount", () => {
    expect(
      needsAdvanceConfirmation({
        remainingCents: -50000,
        previousAmountCents: 80000,
        amountCents: 80000,
      }),
    ).toBe(false);
    expect(
      needsAdvanceConfirmation({
        remainingCents: -50000,
        previousAmountCents: 80000,
        amountCents: 70000,
      }),
    ).toBe(false);
  });
});

describe("canEditPayment", () => {
  // 10:00 clinic time on 2026-10-07, and the next clinic day.
  const createdAt = clinicInstant("2026-10-07", "10:00");
  const sameDay = clinicInstant("2026-10-07", "23:30");
  const nextDay = clinicInstant("2026-10-08", "00:30");
  const base = { staffId: "u1", createdByStaffId: "u1", createdAt };

  it("lets the creator edit on the same clinic day", () => {
    expect(canEditPayment({ ...base, isAdmin: false, now: sameDay })).toBe(true);
  });

  it("refuses the creator the next clinic day", () => {
    expect(canEditPayment({ ...base, isAdmin: false, now: nextDay })).toBe(false);
  });

  it("refuses another staff member", () => {
    expect(
      canEditPayment({ ...base, staffId: "u2", isAdmin: false, now: sameDay }),
    ).toBe(false);
  });

  it("lets the admin edit any payment, any day", () => {
    expect(
      canEditPayment({ ...base, staffId: "admin", isAdmin: true, now: nextDay }),
    ).toBe(true);
  });

  it("refuses everyone but the admin once the creator is gone", () => {
    expect(
      canEditPayment({
        ...base,
        createdByStaffId: null,
        isAdmin: false,
        now: sameDay,
      }),
    ).toBe(false);
  });
});

describe("describeBalance on payment figures", () => {
  it("reads an exact settlement as 0,00 DH still to pay", () => {
    expect(describeBalance(0)).toEqual({
      kind: "due",
      label: BALANCE_LABELS.due,
      amountCents: 0,
    });
  });

  it("reads an overpayment as «Avance» and a positive amount, never clamped", () => {
    expect(describeBalance(-50000)).toEqual({
      kind: "credit",
      label: BALANCE_LABELS.credit,
      amountCents: 50000,
    });
    expect(describeBalance(-1).amountCents).toBe(1);
  });
});

describe("methods", () => {
  it("mirrors the payment_method pgEnum", () => {
    expect(Object.values(PaymentMethod).sort()).toEqual(
      [...paymentMethod.enumValues].sort(),
    );
  });
});
