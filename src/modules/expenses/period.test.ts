import { describe, expect, it } from "vitest";

import { calendarDateRange, clinicInstant, startOfNextClinicDay } from "@/lib/time";
import { filterRange, previousPeriod, previousPeriodRange } from "./period";

describe("previousPeriod", () => {
  it("is the same-length period just before", () => {
    // 31 days → the 31 days before.
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({
      from: "2026-08-31",
      to: "2026-09-30",
    });
    // 7 days, across a month end.
    expect(previousPeriod("2026-10-05", "2026-10-11")).toEqual({
      from: "2026-09-28",
      to: "2026-10-04",
    });
  });

  it("is the day before for a single day", () => {
    expect(previousPeriod("2026-03-01", "2026-03-01")).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
    });
  });

  it("rolls over a year end and a leap day", () => {
    expect(previousPeriod("2026-01-01", "2026-01-31")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(previousPeriod("2028-03-01", "2028-03-02")).toEqual({
      from: "2028-02-28",
      to: "2028-02-29",
    });
  });

  it("is null for an open-ended, malformed or inverted period", () => {
    expect(previousPeriod("", "2026-10-31")).toBeNull();
    expect(previousPeriod("2026-10-01", "")).toBeNull();
    expect(previousPeriod("2026-02-31", "2026-03-05")).toBeNull();
    expect(previousPeriod("2026-10-31", "2026-10-01")).toBeNull();
  });

  it("gives clinic-day instants for the SQL", () => {
    expect(previousPeriodRange("2026-10-01", "2026-10-31")).toEqual(
      calendarDateRange("2026-08-31", "2026-09-30"),
    );
    expect(previousPeriodRange("", "")).toBeNull();
  });
});

describe("filterRange", () => {
  it("bounds the list on clinic midnights", () => {
    expect(filterRange("2026-10-01", "2026-10-31")).toEqual({
      start: clinicInstant("2026-10-01"),
      end: startOfNextClinicDay("2026-10-31"),
    });
  });

  it("puts a charge at 23:59 on the last day of the month inside that month", () => {
    const { start, end } = filterRange("2026-09-01", "2026-09-30");
    const lastMinute = clinicInstant("2026-09-30", "23:59");
    expect(lastMinute.getTime()).toBeGreaterThanOrEqual(start!.getTime());
    expect(lastMinute.getTime()).toBeLessThan(end!.getTime());
    // …and the next month's first day outside.
    expect(clinicInstant("2026-10-01").getTime()).toBe(end!.getTime());
  });

  it("leaves a missing or malformed bound open", () => {
    expect(filterRange("", "")).toEqual({ start: undefined, end: undefined });
    expect(filterRange("hier", "2026-10-31").start).toBeUndefined();
  });
});
