import { z } from "zod";

import {
  isCalendarDate,
  WALL_CLOCK_PATTERN,
  wallClockToMinutes,
} from "@/lib/time";
import {
  EXCEPTION_REASON_MAX,
  SCHEDULE_MINUTE_STEP,
  SCHEDULE_VALIDATION_MESSAGES as M,
  WEEKDAYS,
} from "./constants";
import { exceptionToInstants } from "./exceptions";
import { findRangeIssues } from "./week";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 */

const id = z.string().min(1);

// Zod 4 runs every check of a string even after the regex fails, so a
// malformed value passes here and is reported by the regex alone.
const isOnStep = (wallClock: string) =>
  !WALL_CLOCK_PATTERN.test(wallClock) ||
  wallClockToMinutes(wallClock) % SCHEDULE_MINUTE_STEP === 0;

/** "HH:mm", 24-hour, on a 5-minute mark. */
const wallClock = z
  .string()
  .regex(WALL_CLOCK_PATTERN, { message: M.timeInvalid })
  .refine(isOnStep, { message: M.timeStep });

const practitionerId = z.string().min(1, { message: M.practitionerRequired });

// ── Weekly hours ────────────────────────────────────────────────────────────

export const weekRangeSchema = z.object({
  weekday: z
    .number({ message: M.weekdayInvalid })
    .int({ message: M.weekdayInvalid })
    .min(WEEKDAYS[0], { message: M.weekdayInvalid })
    .max(WEEKDAYS[WEEKDAYS.length - 1], { message: M.weekdayInvalid }),
  startTime: wallClock,
  endTime: wallClock,
});

/**
 * The whole week of one practitioner, replaced at once by `setWeek`. An empty
 * list is valid: it clears the week back to «unconfigured».
 */
export const weekFormSchema = z
  .object({
    practitionerId,
    ranges: z.array(weekRangeSchema),
  })
  .superRefine(({ ranges }, ctx) => {
    for (const issue of findRangeIssues(ranges)) {
      ctx.addIssue({
        code: "custom",
        path: ["ranges", issue.index, issue.field],
        message: issue.message,
      });
    }
  });

export const getWeekSchema = z.object({
  /** Omitted ⇒ the signed-in practitioner, else the first active one. */
  practitionerId: z.string().min(1).nullish(),
});

export type WeekValues = z.output<typeof weekFormSchema>;
export type WeekFormValues = z.input<typeof weekFormSchema>;

// ── Exceptions — congés et fermetures ───────────────────────────────────────

const calendarDate = z
  .string()
  .min(1, { message: M.dateRequired })
  .refine(isCalendarDate, { message: M.dateInvalid });

/**
 * As entered: calendar days plus optional times. The procedure turns it into
 * instants with `exceptionToInstants` — the same function this schema checks
 * `endsAt > startsAt` with, so the form and the database cannot disagree.
 */
export const exceptionFormSchema = z
  .object({
    /** null ⇒ clinic-wide. */
    practitionerId: z.string().min(1).nullable(),
    startDate: calendarDate,
    endDate: calendarDate,
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: z
      .string()
      .trim()
      .max(EXCEPTION_REASON_MAX, { message: M.reasonTooLong })
      .nullish()
      .transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    if (!isCalendarDate(value.startDate) || !isCalendarDate(value.endDate)) {
      return;
    }

    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: M.endDateBeforeStart,
      });
      return;
    }

    if (!value.allDay) {
      let timesValid = true;
      for (const field of ["startTime", "endTime"] as const) {
        const time = value[field];
        const message = !time
          ? M.timeRequired
          : !WALL_CLOCK_PATTERN.test(time)
            ? M.timeInvalid
            : !isOnStep(time)
              ? M.timeStep
              : null;
        if (message) {
          timesValid = false;
          ctx.addIssue({ code: "custom", path: [field], message });
        }
      }
      if (!timesValid) return;
    }

    const { startsAt, endsAt } = exceptionToInstants(value);
    if (endsAt <= startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: M.endsBeforeStarts,
      });
    }
  });

export const exceptionUpdateSchema = exceptionFormSchema.safeExtend({ id });

export const exceptionIdSchema = z.object({ id });

export const getExceptionsSchema = z.object({
  includePast: z.boolean().default(false),
});

export type ExceptionValues = z.output<typeof exceptionFormSchema>;
export type ExceptionFormValues = z.input<typeof exceptionFormSchema>;
