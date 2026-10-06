import { describe, expect, it } from "vitest";

import {
  isWeekConfigured,
  SCHEDULE_VALIDATION_MESSAGES as M,
} from "./constants";
import { exceptionFormSchema, weekFormSchema } from "./schemas";
import { copyDay, flattenWeek, groupWeek, type WeekRange } from "./week";

const week = (ranges: WeekRange[]) =>
  weekFormSchema.safeParse({ practitionerId: "p1", ranges });

/** Every issue as "path: message", for order-insensitive assertions. */
const issuesOf = (ranges: WeekRange[]) => {
  const result = week(ranges);
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
};

const MONDAY_MORNING = { weekday: 1, startTime: "09:00", endTime: "13:00" };
const MONDAY_AFTERNOON = { weekday: 1, startTime: "14:00", endTime: "18:00" };

describe("weekFormSchema — range validation", () => {
  it("accepts a split day and an empty week", () => {
    expect(week([MONDAY_MORNING, MONDAY_AFTERNOON]).success).toBe(true);
    expect(week([]).success).toBe(true);
  });

  it("accepts ranges that touch without overlapping", () => {
    expect(
      week([
        { weekday: 2, startTime: "08:00", endTime: "12:00" },
        { weekday: 2, startTime: "12:00", endTime: "16:00" },
      ]).success,
    ).toBe(true);
  });

  it("refuses an overlap within the same weekday, on the later range", () => {
    expect(
      issuesOf([
        MONDAY_MORNING,
        { weekday: 1, startTime: "12:30", endTime: "15:00" },
      ]),
    ).toEqual([`ranges.1.startTime: ${M.overlap}`]);
  });

  it("refuses a range contained in another, whatever the list order", () => {
    expect(
      issuesOf([
        { weekday: 1, startTime: "10:00", endTime: "11:00" },
        { weekday: 1, startTime: "08:00", endTime: "18:00" },
      ]),
    ).toEqual([`ranges.0.startTime: ${M.overlap}`]);
  });

  it("does not compare ranges across weekdays", () => {
    expect(
      week([MONDAY_MORNING, { ...MONDAY_MORNING, weekday: 2 }]).success,
    ).toBe(true);
  });

  it("refuses start ≥ end — no overnight range", () => {
    expect(
      issuesOf([{ weekday: 1, startTime: "18:00", endTime: "09:00" }]),
    ).toEqual([`ranges.0.endTime: ${M.endBeforeStart}`]);
    expect(
      issuesOf([{ weekday: 1, startTime: "09:00", endTime: "09:00" }]),
    ).toEqual([`ranges.0.endTime: ${M.endBeforeStart}`]);
  });

  it("refuses a time off the 5-minute step", () => {
    expect(
      issuesOf([{ weekday: 1, startTime: "09:07", endTime: "12:00" }]),
    ).toEqual([`ranges.0.startTime: ${M.timeStep}`]);
  });

  it("refuses a malformed or 12-hour time", () => {
    for (const bad of ["9:00", "24:00", "09:00:00", "9 AM", ""]) {
      expect(
        issuesOf([{ weekday: 1, startTime: bad, endTime: "12:00" }]),
      ).toContain(`ranges.0.startTime: ${M.timeInvalid}`);
    }
  });

  it("refuses a weekday outside 1–7", () => {
    for (const weekday of [0, 8, 1.5]) {
      expect(issuesOf([{ ...MONDAY_MORNING, weekday }])).toEqual([
        `ranges.0.weekday: ${M.weekdayInvalid}`,
      ]);
    }
  });

  it("refuses a fourth range on the same day", () => {
    expect(
      issuesOf([
        { weekday: 3, startTime: "08:00", endTime: "09:00" },
        { weekday: 3, startTime: "10:00", endTime: "11:00" },
        { weekday: 3, startTime: "12:00", endTime: "13:00" },
        { weekday: 3, startTime: "14:00", endTime: "15:00" },
      ]),
    ).toEqual([`ranges.3.startTime: ${M.tooManyRanges}`]);
  });

  it("requires a practitioner", () => {
    expect(
      weekFormSchema.safeParse({ practitionerId: "", ranges: [] }).success,
    ).toBe(false);
  });
});

describe("week grouping", () => {
  it("groups database rows into seven days, lundi first, sorted, HH:mm", () => {
    const days = groupWeek([
      { weekday: 1, startTime: "14:00:00", endTime: "18:00:00" },
      { weekday: 1, startTime: "09:00:00", endTime: "13:00:00" },
      { weekday: 6, startTime: "09:00:00", endTime: "12:30:00" },
    ]);

    expect(days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[0].ranges).toEqual([
      { startTime: "09:00", endTime: "13:00" },
      { startTime: "14:00", endTime: "18:00" },
    ]);
    expect(days[5].ranges).toEqual([{ startTime: "09:00", endTime: "12:30" }]);
    expect(days[6].ranges).toEqual([]);
  });

  it("flattens back to what setWeek takes", () => {
    const rows = [
      { weekday: 1, startTime: "09:00", endTime: "13:00" },
      { weekday: 3, startTime: "14:00", endTime: "18:00" },
    ];
    expect(flattenWeek(groupWeek(rows))).toEqual(rows);
  });

  it("is unconfigured with no row, configured with one", () => {
    expect(isWeekConfigured(groupWeek([]))).toBe(false);
    expect(isWeekConfigured(groupWeek([MONDAY_MORNING]))).toBe(true);
  });
});

describe("copyDay", () => {
  it("replaces each target day with the source day's ranges", () => {
    const result = copyDay(
      [
        MONDAY_MORNING,
        MONDAY_AFTERNOON,
        { weekday: 2, startTime: "10:00", endTime: "11:00" },
        { weekday: 5, startTime: "08:00", endTime: "12:00" },
      ],
      1,
      [2, 3, 1],
    );

    expect(groupWeek(result).map((day) => day.ranges.length)).toEqual([
      2, 2, 2, 0, 1, 0, 0,
    ]);
    expect(result.filter((range) => range.weekday === 2)).toEqual([
      { ...MONDAY_MORNING, weekday: 2 },
      { ...MONDAY_AFTERNOON, weekday: 2 },
    ]);
  });

  it("copying an empty day closes the targets", () => {
    expect(copyDay([MONDAY_MORNING], 7, [1])).toEqual([]);
  });
});

describe("exceptionFormSchema", () => {
  const valid = {
    practitionerId: null,
    startDate: "2026-10-12",
    endDate: "2026-10-14",
    allDay: true,
    startTime: "",
    endTime: "",
    reason: "  Congé annuel  ",
  };

  it("accepts a clinic-wide full-day range and trims the reason", () => {
    const parsed = exceptionFormSchema.parse(valid);
    expect(parsed.reason).toBe("Congé annuel");
    expect(parsed.practitionerId).toBeNull();
  });

  it("stores an empty reason as null", () => {
    expect(
      exceptionFormSchema.parse({ ...valid, reason: "" }).reason,
    ).toBeNull();
  });

  it("refuses an end date before the start date", () => {
    const result = exceptionFormSchema.safeParse({
      ...valid,
      endDate: "2026-10-11",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(M.endDateBeforeStart);
  });

  it("requires both times for a partial day", () => {
    const result = exceptionFormSchema.safeParse({
      ...valid,
      allDay: false,
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "startTime",
      "endTime",
    ]);
  });

  it("refuses a partial same-day range that ends before it starts", () => {
    const result = exceptionFormSchema.safeParse({
      ...valid,
      endDate: valid.startDate,
      allDay: false,
      startTime: "14:00",
      endTime: "09:00",
    });
    expect(result.error?.issues[0]?.message).toBe(M.endsBeforeStarts);
  });

  it("refuses an impossible date", () => {
    expect(
      exceptionFormSchema.safeParse({ ...valid, startDate: "2026-02-30" })
        .success,
    ).toBe(false);
  });
});
