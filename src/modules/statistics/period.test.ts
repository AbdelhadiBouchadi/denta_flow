import { describe, expect, it } from "vitest";

import { clinicInstant, startOfNextClinicDay } from "@/lib/time";
import { STATISTICS_PERIOD_ERRORS as E } from "./constants";
import {
  addCalendarMonths,
  customRangeError,
  latestCustomEnd,
  resolvePeriod,
  toPeriodInput,
} from "./period";
import { statisticsInputSchema } from "./schemas";
import { StatisticsPeriod } from "./types";

// Tuesday 2026-10-13, 10:00 on the clinic's wall clock. Instants are built
// through the clinic timezone, never with a hardcoded offset: tzdata decides
// whether Casablanca is UTC+0 or UTC+1 on a given day.
const NOW = clinicInstant("2026-10-13", "10:00");
const preset = (period: StatisticsPeriod) => ({ period, from: "", to: "" });
const custom = (from: string, to: string) => ({
  period: StatisticsPeriod.Custom,
  from,
  to,
});
const days = (period: StatisticsPeriod) => {
  const { from, to, previous } = resolvePeriod(preset(period), NOW);
  return { from, to, previous: { from: previous.from, to: previous.to } };
};

describe("resolvePeriod — presets", () => {
  it("this month: the whole calendar month, compared with the previous month", () => {
    expect(days(StatisticsPeriod.ThisMonth)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      previous: { from: "2026-09-01", to: "2026-09-30" },
    });
  });

  it("last month, compared with the month before", () => {
    expect(days(StatisticsPeriod.LastMonth)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      previous: { from: "2026-08-01", to: "2026-08-31" },
    });
  });

  it("last 90 days ends today and compares with the 90 days before", () => {
    expect(days(StatisticsPeriod.Last90Days)).toEqual({
      from: "2026-07-16",
      to: "2026-10-13",
      previous: { from: "2026-04-17", to: "2026-07-15" },
    });
  });

  it("this year, compared with last year", () => {
    expect(days(StatisticsPeriod.ThisYear)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
      previous: { from: "2025-01-01", to: "2025-12-31" },
    });
  });

  it("last 12 months: twelve whole months ending with this one", () => {
    expect(days(StatisticsPeriod.Last12Months)).toEqual({
      from: "2025-11-01",
      to: "2026-10-31",
      previous: { from: "2024-11-01", to: "2025-10-31" },
    });
  });

  it("this month in January compares with December of the year before", () => {
    const { previous } = resolvePeriod(
      preset(StatisticsPeriod.ThisMonth),
      "2027-01-15T12:00:00Z",
    );
    expect([previous.from, previous.to]).toEqual(["2026-12-01", "2026-12-31"]);
  });

  it("is read on the clinic clock, either side of midnight", () => {
    const at = (day: string, time: string) =>
      resolvePeriod(
        preset(StatisticsPeriod.ThisMonth),
        clinicInstant(day, time),
      ).from;
    expect(at("2026-10-31", "23:59")).toBe("2026-10-01");
    expect(at("2026-11-01", "00:01")).toBe("2026-11-01");
  });

  it("the range is the clinic-midnight instants of the days", () => {
    const { range } = resolvePeriod(preset(StatisticsPeriod.ThisMonth), NOW);
    expect(range.start).toEqual(clinicInstant("2026-10-01"));
    expect(range.end).toEqual(startOfNextClinicDay("2026-10-31"));
  });
});

describe("resolvePeriod — custom", () => {
  it("keeps the days and compares with the same number of days before", () => {
    const { from, to, previous } = resolvePeriod(
      custom("2026-09-10", "2026-09-19"),
      NOW,
    );
    expect([from, to]).toEqual(["2026-09-10", "2026-09-19"]);
    expect([previous.from, previous.to]).toEqual(["2026-08-31", "2026-09-09"]);
  });
});

describe("customRangeError", () => {
  it("accepts every preset whatever from / to say", () => {
    for (const period of Object.values(StatisticsPeriod)) {
      if (period === StatisticsPeriod.Custom) continue;
      expect(customRangeError({ period, from: "x", to: "y" }, NOW)).toBeNull();
    }
  });

  it("accepts a valid range ending today", () => {
    expect(
      customRangeError(custom("2026-01-01", "2026-10-13"), NOW),
    ).toBeNull();
  });

  it("refuses missing or malformed days", () => {
    expect(customRangeError(custom("", "2026-10-01"), NOW)).toBe(E.fromInvalid);
    expect(customRangeError(custom("2026-02-30", "2026-03-01"), NOW)).toBe(
      E.fromInvalid,
    );
    expect(customRangeError(custom("2026-10-01", ""), NOW)).toBe(E.toInvalid);
  });

  it("refuses from > to", () => {
    expect(customRangeError(custom("2026-05-10", "2026-05-01"), NOW)).toBe(
      E.fromAfterTo,
    );
  });

  it("refuses a `to` after today, on the clinic clock", () => {
    expect(customRangeError(custom("2026-10-01", "2026-10-14"), NOW)).toBe(
      E.toInFuture,
    );
    // Just after clinic midnight, the 14th is today.
    expect(
      customRangeError(
        custom("2026-10-01", "2026-10-14"),
        clinicInstant("2026-10-14", "00:01"),
      ),
    ).toBeNull();
  });

  it("allows exactly 24 months and refuses one day more", () => {
    expect(latestCustomEnd("2024-10-14")).toBe("2026-10-13");
    expect(
      customRangeError(custom("2024-10-14", "2026-10-13"), NOW),
    ).toBeNull();
    expect(customRangeError(custom("2024-10-13", "2026-10-13"), NOW)).toBe(
      E.tooLong,
    );
  });

  it("speaks French", () => {
    expect(Object.values(E).every((message) => /[a-zé]/.test(message))).toBe(
      true,
    );
    expect(E.tooLong).toBe("La période ne peut pas dépasser 24 mois");
  });
});

describe("statisticsInputSchema", () => {
  it("refuses an inverted custom range with the French message", () => {
    const result = statisticsInputSchema.safeParse(
      custom("2026-05-10", "2026-05-01"),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(E.fromAfterTo);
  });

  it("refuses an unknown preset", () => {
    expect(
      statisticsInputSchema.safeParse({ period: "forever", from: "", to: "" })
        .success,
    ).toBe(false);
  });
});

describe("addCalendarMonths", () => {
  it("clamps to the end of a shorter month", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2027-12-31", 2)).toBe("2028-02-29");
  });
});

describe("toPeriodInput", () => {
  it("drops a stale custom range from a preset's query key", () => {
    expect(
      toPeriodInput({
        period: StatisticsPeriod.ThisYear,
        from: "2026-01-01",
        to: "2026-02-01",
      }),
    ).toEqual({ period: StatisticsPeriod.ThisYear, from: "", to: "" });
  });

  it("keeps a custom range as typed", () => {
    expect(toPeriodInput(custom("2026-01-01", "2026-02-01"))).toEqual(
      custom("2026-01-01", "2026-02-01"),
    );
  });
});
