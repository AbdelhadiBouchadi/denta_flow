import { describe, expect, it } from "vitest";

import { CalendarView } from "../types";
import {
  addCalendarDays,
  getDaysForView,
  getRangeForView,
  isoWeekday,
  resolveAnchorDate,
  shiftAnchorDate,
} from "./get-range-for-view";

/**
 * Offsets used below, from the IANA database Node ships with:
 *   · Morocco leaves UTC+1 for UTC+0 on 2026-02-15 (Ramadan)
 *   · and returns to UTC+1 on 2026-03-22.
 * Clinic midnight is therefore 00:00Z inside Ramadan and 23:00Z the day
 * before outside it.
 */
const iso = (range: { from: Date; to: Date }) => ({
  from: range.from.toISOString(),
  to: range.to.toISOString(),
});

describe("calendar-day helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads ISO weekdays, lundi = 1, dimanche = 7", () => {
    expect(isoWeekday("2026-03-16")).toBe(1);
    expect(isoWeekday("2026-03-22")).toBe(7);
  });
});

describe("getRangeForView — day", () => {
  it("covers one clinic day outside Ramadan (UTC+1)", () => {
    expect(iso(getRangeForView("2026-06-15", CalendarView.Day))).toEqual({
      from: "2026-06-14T23:00:00.000Z",
      to: "2026-06-15T23:00:00.000Z",
    });
  });

  it("covers one clinic day inside Ramadan (UTC+0)", () => {
    expect(iso(getRangeForView("2026-03-05", CalendarView.Day))).toEqual({
      from: "2026-03-05T00:00:00.000Z",
      to: "2026-03-06T00:00:00.000Z",
    });
  });

  it("is 23 hours long on the day the clock moves forward", () => {
    const { from, to } = getRangeForView("2026-03-22", CalendarView.Day);
    expect(from.toISOString()).toBe("2026-03-22T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-22T23:00:00.000Z");
  });
});

describe("getRangeForView — week", () => {
  it("starts on Monday whatever day is the anchor", () => {
    for (const anchor of ["2026-06-15", "2026-06-17", "2026-06-21"]) {
      expect(getDaysForView(anchor, CalendarView.Week)).toEqual({
        first: "2026-06-15",
        afterLast: "2026-06-22",
      });
    }
  });

  it("crosses the end of Ramadan: starts at UTC+0, ends at UTC+1", () => {
    expect(iso(getRangeForView("2026-03-18", CalendarView.Week))).toEqual({
      from: "2026-03-16T00:00:00.000Z",
      to: "2026-03-22T23:00:00.000Z",
    });
  });
});

describe("getRangeForView — month", () => {
  it("covers the full Monday-to-Sunday grid around the month", () => {
    // March 2026 starts on a Sunday and ends on a Tuesday.
    expect(getDaysForView("2026-03-12", CalendarView.Month)).toEqual({
      first: "2026-02-23",
      afterLast: "2026-04-06",
    });
  });

  it("resolves each end in its own offset across Ramadan", () => {
    expect(iso(getRangeForView("2026-03-12", CalendarView.Month))).toEqual({
      from: "2026-02-23T00:00:00.000Z",
      to: "2026-04-05T23:00:00.000Z",
    });
  });

  it("does not add a spare week when the month ends on a Sunday", () => {
    // May 2026 ends on Sunday the 31st.
    expect(getDaysForView("2026-05-10", CalendarView.Month).afterLast).toBe(
      "2026-06-01",
    );
  });
});

describe("getRangeForView — agenda", () => {
  it("covers 30 days from the anchor", () => {
    expect(getDaysForView("2026-03-05", CalendarView.Agenda)).toEqual({
      first: "2026-03-05",
      afterLast: "2026-04-04",
    });
  });
});

describe("every view", () => {
  it.each(Object.values(CalendarView))(
    "%s yields a non-empty half-open range containing the anchor",
    (view) => {
      const anchor = "2026-03-19";
      const { from, to } = getRangeForView(anchor, view);
      const anchorNoon = new Date("2026-03-19T12:00:00Z");
      expect(from.getTime()).toBeLessThan(to.getTime());
      expect(from.getTime()).toBeLessThanOrEqual(anchorNoon.getTime());
      expect(to.getTime()).toBeGreaterThan(anchorNoon.getTime());
    },
  );
});

describe("resolveAnchorDate", () => {
  it("keeps a valid calendar date", () => {
    expect(resolveAnchorDate("2026-03-12")).toBe("2026-03-12");
  });

  it.each(["", null, undefined, "2026-02-30", "demain"])(
    "falls back to today for %j",
    (value) => {
      expect(resolveAnchorDate(value)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );
});

describe("shiftAnchorDate", () => {
  it("moves by one period", () => {
    expect(shiftAnchorDate("2026-03-12", CalendarView.Day, 1)).toBe(
      "2026-03-13",
    );
    expect(shiftAnchorDate("2026-03-12", CalendarView.Week, -1)).toBe(
      "2026-03-05",
    );
    expect(shiftAnchorDate("2026-03-12", CalendarView.Agenda, 1)).toBe(
      "2026-04-11",
    );
  });

  it("lands on the 1st when moving by month, so February is never skipped", () => {
    expect(shiftAnchorDate("2026-01-31", CalendarView.Month, 1)).toBe(
      "2026-02-01",
    );
    expect(shiftAnchorDate("2026-01-15", CalendarView.Month, -1)).toBe(
      "2025-12-01",
    );
  });
});
