import { describe, expect, it } from "vitest";

import { calendarDateRange, clinicInstant, toClinicDate } from "@/lib/time";
import {
  isFutureDay,
  isoWeekdayOf,
  resolveActivityDay,
  weekDaysOf,
  weekStartOf,
} from "./week";

describe("the Monday-first week of a calendar day", () => {
  it("knows the ISO weekday", () => {
    expect(isoWeekdayOf("2026-10-05")).toBe(1); // lundi
    expect(isoWeekdayOf("2026-10-11")).toBe(7); // dimanche
  });

  it("starts on Monday, Sunday included in the week before it", () => {
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-08")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
  });

  it("lists seven days across a month and a year end", () => {
    expect(weekDaysOf("2026-12-31")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("resolveActivityDay", () => {
  it('reads "" as today', () => {
    expect(resolveActivityDay("", "2026-10-11")).toBe("2026-10-11");
  });
  it("keeps a real calendar day", () => {
    expect(resolveActivityDay("2026-10-01", "2026-10-11")).toBe("2026-10-01");
  });
  it("refuses anything else", () => {
    expect(resolveActivityDay("2026-02-31", "2026-10-11")).toBeNull();
    expect(resolveActivityDay("hier", "2026-10-11")).toBeNull();
  });
  it("tells the future apart", () => {
    expect(isFutureDay("2026-10-12", "2026-10-11")).toBe(true);
    expect(isFutureDay("2026-10-11", "2026-10-11")).toBe(false);
  });
});

describe("a line at 23:59 clinic time belongs to its own day", () => {
  // The bounds `getDay` filters on. The instant is drawn from the clinic's
  // wall clock, never from a written offset: Casablanca's offset moves with
  // Ramadan (and with the tz database), and the rule must hold whatever it is.
  it.each(["2026-10-08", "2026-03-05", "2026-04-15"])("on %s", (day) => {
    const { start, end } = calendarDateRange(day, day);
    const at = clinicInstant(day, "23:59");
    expect(at >= start && at < end).toBe(true);
    expect(toClinicDate(at)).toBe(day);
    // One minute later is the next day's first line.
    const next = new Date(at.getTime() + 60_000);
    expect(next.getTime()).toBe(end.getTime());
    expect(toClinicDate(next)).not.toBe(day);
  });
});
