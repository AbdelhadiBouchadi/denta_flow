import { tzOffset } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { CLINIC_TIMEZONE } from "@/constants";
import {
  clinicNow,
  endOfClinicDay,
  fromClinicTime,
  startOfClinicDay,
  startOfClinicWeek,
  toClinicTime,
} from "@/lib/time";

/**
 * These run with TZ=UTC (set in vitest.config.ts) so that a helper quietly
 * falling back to the system timezone fails here instead of on the clinic's
 * machine, which sits in Africa/Casablanca and would hide the bug.
 *
 * Two regimes are exercised on purpose:
 *   · 2026-06-15 — Morocco at UTC+1, the usual case
 *   · 2026-03-05 — inside Ramadan 2026, Morocco at UTC+0
 * A hardcoded "+01:00" passes the first and fails the second.
 */

const SUMMER_INSTANT = "2026-06-15T12:00:00Z";
const RAMADAN_INSTANT = "2026-03-05T12:00:00Z";

describe("the test environment itself", () => {
  it("runs with TZ=UTC", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date(SUMMER_INSTANT).getHours()).toBe(12);
  });

  it("reads two different offsets for the clinic across the year", () => {
    expect(tzOffset(CLINIC_TIMEZONE, new Date(SUMMER_INSTANT))).toBe(60);
    expect(tzOffset(CLINIC_TIMEZONE, new Date(RAMADAN_INSTANT))).toBe(0);
  });
});

describe("toClinicTime", () => {
  it("keeps the instant and changes only the frame it is read in", () => {
    const instant = new Date(SUMMER_INSTANT);

    expect(toClinicTime(instant).getTime()).toBe(instant.getTime());
    expect(toClinicTime(instant).timeZone).toBe(CLINIC_TIMEZONE);
    expect(toClinicTime(instant).getHours()).toBe(13);
  });

  it("accepts an ISO string and epoch millis", () => {
    const millis = Date.parse(SUMMER_INSTANT);

    expect(toClinicTime(SUMMER_INSTANT).getTime()).toBe(millis);
    expect(toClinicTime(millis).getTime()).toBe(millis);
  });
});

describe("startOfClinicDay", () => {
  it("is midnight in the clinic, not midnight UTC", () => {
    expect(startOfClinicDay(SUMMER_INSTANT).getTime()).toBe(
      Date.UTC(2026, 5, 14, 23, 0, 0, 0),
    );
  });

  it("is midnight UTC during Ramadan, when Morocco is at UTC+0", () => {
    expect(startOfClinicDay(RAMADAN_INSTANT).getTime()).toBe(
      Date.UTC(2026, 2, 5, 0, 0, 0, 0),
    );
  });

  it("is idempotent, and one millisecond earlier belongs to the previous day", () => {
    const start = startOfClinicDay(SUMMER_INSTANT);

    expect(startOfClinicDay(start).getTime()).toBe(start.getTime());
    expect(startOfClinicDay(start.getTime() - 1).getTime()).toBe(
      Date.UTC(2026, 5, 13, 23, 0, 0, 0),
    );
  });
});

describe("endOfClinicDay", () => {
  it("closes the clinic day at 23:59:59.999 local", () => {
    expect(endOfClinicDay(SUMMER_INSTANT).getTime()).toBe(
      Date.UTC(2026, 5, 15, 22, 59, 59, 999),
    );
  });

  it("closes it at 23:59:59.999 UTC during Ramadan", () => {
    expect(endOfClinicDay(RAMADAN_INSTANT).getTime()).toBe(
      Date.UTC(2026, 2, 5, 23, 59, 59, 999),
    );
  });

  it("spans exactly one day minus a millisecond", () => {
    const span =
      endOfClinicDay(SUMMER_INSTANT).getTime() -
      startOfClinicDay(SUMMER_INSTANT).getTime();

    expect(span).toBe(24 * 60 * 60 * 1000 - 1);
  });
});

describe("startOfClinicWeek", () => {
  // 2026-06-15 is a Monday, 2026-06-21 the Sunday that closes the same week.
  const expectedWeekStart = Date.UTC(2026, 5, 14, 23, 0, 0, 0);

  it("starts the week on Monday", () => {
    expect(startOfClinicWeek("2026-06-17T10:00:00Z").getTime()).toBe(
      expectedWeekStart,
    );
  });

  it("keeps Sunday in the week that began the Monday before", () => {
    expect(startOfClinicWeek("2026-06-21T10:00:00Z").getTime()).toBe(
      expectedWeekStart,
    );
  });

  it("is the start of a clinic day too", () => {
    const weekStart = startOfClinicWeek("2026-06-17T10:00:00Z");

    expect(startOfClinicDay(weekStart).getTime()).toBe(weekStart.getTime());
  });
});

describe("fromClinicTime", () => {
  it("round-trips an instant through the clinic frame", () => {
    const instant = new Date(SUMMER_INSTANT);

    expect(fromClinicTime(toClinicTime(instant)).getTime()).toBe(
      instant.getTime(),
    );
  });

  it("round-trips during Ramadan as well", () => {
    const instant = new Date(RAMADAN_INSTANT);

    expect(fromClinicTime(toClinicTime(instant)).getTime()).toBe(
      instant.getTime(),
    );
  });

  it("reads wall-clock fields as clinic time", () => {
    // What a date picker hands over on a machine running UTC: 15/06/2026 14:30.
    // In the clinic that names 13:30 UTC, because Morocco is at UTC+1 in June.
    const picked = new Date(2026, 5, 15, 14, 30, 0, 0);

    expect(fromClinicTime(picked).toISOString()).toBe(
      "2026-06-15T13:30:00.000Z",
    );
  });

  it("reads the same fields as UTC during Ramadan", () => {
    const picked = new Date(2026, 2, 5, 14, 30, 0, 0);

    expect(fromClinicTime(picked).toISOString()).toBe(
      "2026-03-05T14:30:00.000Z",
    );
  });

  it("returns a plain Date, ready for the database", () => {
    const utc = fromClinicTime(toClinicTime(SUMMER_INSTANT));

    expect(utc.constructor).toBe(Date);
    expect(utc.toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });
});

describe("clinicNow", () => {
  it("is the current instant, read in the clinic timezone", () => {
    const before = Date.now();
    const now = clinicNow();
    const after = Date.now();

    expect(now.timeZone).toBe(CLINIC_TIMEZONE);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
