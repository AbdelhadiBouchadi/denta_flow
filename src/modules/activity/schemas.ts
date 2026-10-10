import { z } from "zod";

import { isCalendarDate } from "@/lib/time";
import { ACTIVITY_VALIDATION_MESSAGES as M } from "./constants";

/**
 * A clinic calendar day "yyyy-MM-dd", or "" for today. «Not in the future»
 * needs the clinic's clock, so the procedure checks it, not this schema.
 */
const activityDay = z
  .string()
  .refine((value) => value === "" || isCalendarDate(value), M.invalidDate);

/** "" ⇒ every staff member. A filter the user chose — never the caller. */
const staffFilter = z.string().max(64);

/**
 * `getDay`. `cursor` is set by the infinite query, never by a caller;
 * tRPC also adds `direction`, which this object strips.
 */
export const activityGetDaySchema = z.object({
  date: activityDay,
  staffId: staffFilter,
  cursor: z.string().max(128).nullish(),
});

/** `getDayCounts`: any day of the week; the same staff filter as the list. */
export const activityDayCountsSchema = z.object({
  weekOf: activityDay,
  staffId: staffFilter,
});
