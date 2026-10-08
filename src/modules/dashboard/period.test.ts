import { describe, expect, it } from "vitest";

import { periodDates, periodRange } from "./period";
import { DashboardPeriod } from "./types";

// Thursday 2026-10-08, 10:00 in Casablanca.
const THURSDAY = "2026-10-08T10:00:00Z";

describe("periodDates", () => {
  it("today is the clinic day", () => {
    expect(periodDates(DashboardPeriod.Today, THURSDAY)).toEqual({
      from: "2026-10-08",
      to: "2026-10-08",
    });
  });

  it("the week starts on Monday and ends on Sunday", () => {
    expect(periodDates(DashboardPeriod.Week, THURSDAY)).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("on a Sunday the week is the one that started six days earlier", () => {
    expect(periodDates(DashboardPeriod.Week, "2026-10-11T12:00:00Z")).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("on a Monday the week starts that day", () => {
    expect(periodDates(DashboardPeriod.Week, "2026-10-12T12:00:00Z")).toEqual({
      from: "2026-10-12",
      to: "2026-10-18",
    });
  });

  it("a week can straddle two years", () => {
    expect(periodDates(DashboardPeriod.Week, "2026-12-31T12:00:00Z")).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });

  it("the month runs from the 1st to its last day", () => {
    expect(periodDates(DashboardPeriod.Month, THURSDAY)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(periodDates(DashboardPeriod.Month, "2028-02-10T12:00:00Z")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("last month rolls back over a year end", () => {
    expect(periodDates(DashboardPeriod.LastMonth, THURSDAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(
      periodDates(DashboardPeriod.LastMonth, "2027-01-15T12:00:00Z"),
    ).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("the year is the calendar year", () => {
    expect(periodDates(DashboardPeriod.Year, THURSDAY)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("reads the clinic clock, not UTC: 00:30 on the 1st is already the new month", () => {
    // 2026-07-01 00:30 in Casablanca (UTC+1) = 2026-06-30 23:30Z.
    expect(periodDates(DashboardPeriod.Month, "2026-06-30T23:30:00Z")).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });
});

describe("periodRange", () => {
  it("is [clinic midnight of the first day, clinic midnight after the last)", () => {
    // June 2026: Morocco at UTC+1, so clinic midnight is 23:00Z the day before.
    const { start, end } = periodRange(
      DashboardPeriod.Month,
      "2026-06-10T10:00:00Z",
    );
    expect(start.toISOString()).toBe("2026-05-31T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-30T23:00:00.000Z");
  });

  it("today's range is the clinic day range", () => {
    const { start, end } = periodRange(
      DashboardPeriod.Today,
      "2026-06-15T23:30:00Z",
    );
    expect(start.toISOString()).toBe("2026-06-15T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-16T23:00:00.000Z");
  });
});
