import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { clinicInstant, toClinicDate, toClinicWallClock } from "@/lib/time";
import { PAYMENT_VALIDATION_MESSAGES as M } from "./constants";
import { resolvePaidAt, toFormValues } from "./form-values";
import { paymentFormSchema } from "./schemas";
import { PaymentMethod, type PaymentListItem } from "./types";

/**
 * paidAt → form fields → paidAt must be a no-op, and «now» must be neither
 * refused as future nor stored an hour ahead — whatever the machine's
 * timezone (prompts/18b-calendrier-fixes.md §2). Each block runs under
 * TZ=UTC and TZ=Asia/Tokyo; Node re-reads `process.env.TZ` when it changes.
 *
 * Instants are built from the clinic wall clock, never from a written
 * offset: per tzdata 2026c Morocco is UTC+0 from 2026-09-20 and was UTC+1 in
 * June, so both a zero and a non-zero offset are covered.
 */

const DAYS = ["2026-10-07", "2026-06-15"];
const TIMES = ["00:30", "09:15", "23:45"];

/** The fields `toFormValues` reads from a stored payment. */
const stored = (paidAt: Date) =>
  ({
    patientId: "p1",
    amountCents: 150000,
    method: PaymentMethod.Cash,
    paidAt,
    treatmentId: null,
    insurerId: null,
    reference: null,
    notes: null,
  }) as unknown as PaymentListItem;

describe.each(["UTC", "Asia/Tokyo"])("under TZ=%s", (zone) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs in the zone it claims", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  });

  for (const day of DAYS) {
    for (const time of TIMES) {
      it(`round-trips ${day} ${time} clinic time`, () => {
        const paidAt = resolvePaidAt({ paidDate: day, paidTime: time });
        expect(paidAt).toEqual(clinicInstant(day, time));

        // Reopened in edit: the same day and wall clock come back…
        const values = toFormValues(stored(paidAt));
        expect(values.paidDate).toBe(day);
        expect(values.paidTime).toBe(time);

        // …and saving it untouched stores the same instant.
        expect(
          resolvePaidAt({
            paidDate: values.paidDate,
            paidTime: values.paidTime,
          }),
        ).toEqual(paidAt);
      });
    }
  }

  it("defaults a new payment to now on the clinic clock, accepted as not future", () => {
    vi.useFakeTimers();
    const now = clinicInstant("2026-10-07", "12:26");
    vi.setSystemTime(new Date(now.getTime() + 40_000)); // 12:26:40

    const values = toFormValues();
    expect(values.paidDate).toBe(toClinicDate(now));
    expect(values.paidTime).toBe(toClinicWallClock(now));
    expect(values.paidTime).toBe("12:26");

    const parsed = paymentFormSchema.parse({
      ...values,
      patientId: "p1",
      amountCents: 100,
    });
    // Stored at the minute entered — not an hour ahead, not an hour behind.
    expect(resolvePaidAt(parsed)).toEqual(now);
  });

  it("refuses one minute ahead of the clinic clock as future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(clinicInstant("2026-10-07", "12:26"));

    const result = paymentFormSchema.safeParse({
      ...toFormValues(),
      patientId: "p1",
      amountCents: 100,
      paidTime: "12:27",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      M.inFuture,
    ]);
  });
});
