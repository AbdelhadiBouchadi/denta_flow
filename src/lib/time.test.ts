import { tzOffset } from "@date-fns/tz";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CLINIC_TIMEZONE } from "@/constants";
import {
  addCalendarDays,
  calendarDateRange,
  clinicDayRange,
  clinicInstant,
  clinicNow,
  endOfClinicDay,
  fromClinicTime,
  fromPgTime,
  isCalendarDate,
  minutesToWallClock,
  previousCalendarDate,
  startOfClinicDay,
  startOfClinicWeek,
  startOfNextClinicDay,
  toClinicDate,
  toClinicTime,
  toClinicWallClock,
  toPgTime,
  wallClockToMinutes,
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

describe("wall-clock times", () => {
  it("converts HH:mm to minutes and back", () => {
    expect(wallClockToMinutes("00:00")).toBe(0);
    expect(wallClockToMinutes("09:30")).toBe(570);
    expect(wallClockToMinutes("23:55")).toBe(1435);
    expect(minutesToWallClock(570)).toBe("09:30");
    expect(minutesToWallClock(0)).toBe("00:00");
  });

  it("refuses anything that is not a 24-hour HH:mm", () => {
    for (const bad of ["9:30", "24:00", "12:60", "09:30:00", "", "9h30"]) {
      expect(() => wallClockToMinutes(bad)).toThrow(RangeError);
    }
  });

  it("round-trips HH:mm through a Postgres time literal", () => {
    for (const wallClock of ["00:00", "08:05", "12:30", "23:55"]) {
      expect(toPgTime(wallClock)).toBe(`${wallClock}:00`);
      expect(fromPgTime(toPgTime(wallClock))).toBe(wallClock);
    }
  });

  it("is a wall-clock value: the process timezone never shifts it", () => {
    // TZ=UTC here; the clinic is UTC+1. "09:00" stays "09:00" both ways.
    expect(fromPgTime("09:00:00")).toBe("09:00");
  });
});

describe("calendar dates", () => {
  it("accepts real days only", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("15/06/2026")).toBe(false);
  });

  it("steps back one day across a month and a year", () => {
    expect(previousCalendarDate("2026-03-01")).toBe("2026-02-28");
    expect(previousCalendarDate("2026-01-01")).toBe("2025-12-31");
  });
});

describe("clinicInstant", () => {
  it("resolves clinic midnight at UTC+1 in April 2026", () => {
    expect(clinicInstant("2026-04-15").toISOString()).toBe(
      "2026-04-14T23:00:00.000Z",
    );
  });

  it("resolves clinic midnight at UTC+0 inside Ramadan 2026", () => {
    expect(clinicInstant("2026-03-05").toISOString()).toBe(
      "2026-03-05T00:00:00.000Z",
    );
  });

  it("places a wall-clock time on the clinic day", () => {
    expect(clinicInstant("2026-06-15", "14:30").toISOString()).toBe(
      "2026-06-15T13:30:00.000Z",
    );
  });

  it("round-trips through toClinicDate and toClinicWallClock", () => {
    for (const [date, time] of [
      ["2026-03-05", "08:15"],
      ["2026-06-15", "00:00"],
      ["2026-12-31", "23:55"],
    ] as const) {
      const instant = clinicInstant(date, time);
      expect(toClinicDate(instant)).toBe(date);
      expect(toClinicWallClock(instant)).toBe(time);
    }
  });
});

describe("startOfNextClinicDay", () => {
  it("is the next clinic midnight, across a month end", () => {
    expect(startOfNextClinicDay("2026-06-30").toISOString()).toBe(
      "2026-06-30T23:00:00.000Z",
    );
  });

  it("is midnight UTC on a Ramadan day", () => {
    expect(startOfNextClinicDay("2026-03-05").toISOString()).toBe(
      "2026-03-06T00:00:00.000Z",
    );
  });
});

// ── clinicDayRange (prompts/22) ─────────────────────────────────────────────
//
// «Today» on the dashboard. Summer: Morocco UTC+1, so the clinic day starts
// at 23:00Z the evening before. 2026-02-15 the clock goes back (03:00 → 02:00,
// a 25 h day); 2026-03-22 it goes forward (02:00 → 03:00, a 23 h day).

const HOUR_MS = 60 * 60 * 1000;

const expectRange = (
  range: { start: Date; end: Date },
  start: string,
  end: string,
) => {
  expect(range.start.toISOString()).toBe(start);
  expect(range.end.toISOString()).toBe(end);
};

const clinicDayRangeCases = () => {
  it("at 23:30 clinic time, is still that clinic day", () => {
    // 2026-06-15 23:30 in Casablanca (UTC+1) = 22:30Z.
    expectRange(
      clinicDayRange("2026-06-15T22:30:00Z"),
      "2026-06-14T23:00:00.000Z",
      "2026-06-15T23:00:00.000Z",
    );
  });

  it("at 00:30 clinic time, is already the new clinic day — while UTC is still on the old date", () => {
    // 2026-06-16 00:30 in Casablanca = 2026-06-15 23:30Z.
    expectRange(
      clinicDayRange("2026-06-15T23:30:00Z"),
      "2026-06-15T23:00:00.000Z",
      "2026-06-16T23:00:00.000Z",
    );
  });

  it("is 25 hours long on the day the clinic clock goes back", () => {
    const range = clinicDayRange("2026-02-15T12:00:00Z");
    expectRange(range, "2026-02-14T23:00:00.000Z", "2026-02-16T00:00:00.000Z");
    expect(range.end.getTime() - range.start.getTime()).toBe(25 * HOUR_MS);
  });

  it("is 23 hours long on the day the clinic clock goes forward", () => {
    const range = clinicDayRange("2026-03-22T12:00:00Z");
    expectRange(range, "2026-03-22T00:00:00.000Z", "2026-03-22T23:00:00.000Z");
    expect(range.end.getTime() - range.start.getTime()).toBe(23 * HOUR_MS);
  });

  it("contains the instant it was built from, half-open", () => {
    for (const instant of [
      "2026-06-15T22:30:00Z",
      "2026-06-15T23:00:00Z",
      "2026-03-05T00:00:00Z",
      "2026-02-15T02:30:00Z",
    ]) {
      const { start, end } = clinicDayRange(instant);
      const at = new Date(instant).getTime();
      expect(start.getTime()).toBeLessThanOrEqual(at);
      expect(at).toBeLessThan(end.getTime());
    }
  });
};

describe("clinicDayRange, TZ=UTC", () => {
  it("runs in UTC", () => {
    expect(new Date("2026-06-15T12:00:00Z").getTimezoneOffset()).toBe(0);
  });
  clinicDayRangeCases();
});

describe("clinicDayRange, TZ=Asia/Tokyo", () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
  });
  afterEach(() => {
    process.env.TZ = previous;
  });

  it("really runs in Tokyo", () => {
    expect(new Date("2026-06-15T12:00:00Z").getTimezoneOffset()).toBe(-540);
  });
  clinicDayRangeCases();
});

describe("calendarDateRange", () => {
  it("covers both days, from clinic midnight to the next clinic midnight", () => {
    expectRange(
      calendarDateRange("2026-06-01", "2026-06-30"),
      "2026-05-31T23:00:00.000Z",
      "2026-06-30T23:00:00.000Z",
    );
  });
});

describe("addCalendarDays", () => {
  it("rolls over month and year ends, both ways", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCalendarDays("2026-06-15", 0)).toBe("2026-06-15");
  });
});
