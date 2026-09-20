import { TZDate } from "@date-fns/tz";
import { endOfDay, startOfDay, startOfWeek } from "date-fns";

import { CLINIC_TIMEZONE, WEEK_STARTS_ON } from "@/constants";

/**
 * Every day/week boundary in the app goes through this file.
 *
 * Morocco is UTC+1 for most of the year and reverts to UTC+0 for the whole of
 * Ramadan, whose dates move every year. A literal "+01:00" anywhere would be
 * silently wrong for roughly one month a year — appointments an hour off, a
 * day's takings attributed to the wrong day. `TZDate` reads the IANA database
 * instead, so the offset is never written down here.
 *
 * Instants are stored in UTC. These helpers only change the frame the instant
 * is read in; they never change the instant itself.
 */

/** Anything an instant can arrive as: a Date, an ISO string, or epoch millis. */
export type ClinicDateInput = Date | string | number;

/** Now, read in the clinic timezone. */
export const clinicNow = (): TZDate => TZDate.tz(CLINIC_TIMEZONE);

// TZDate overloads each accepted form separately, so the union is collapsed
// to epoch millis before it reaches the constructor.
const toTimestamp = (value: ClinicDateInput) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return value.getTime();
};

/**
 * A UTC instant seen on the clinic's wall clock. Same instant, different frame.
 * date-fns keeps the timezone across its own operations, so anything derived
 * from the result stays clinic-local.
 */
export const toClinicTime = (utc: ClinicDateInput): TZDate =>
  new TZDate(toTimestamp(utc), CLINIC_TIMEZONE);

/**
 * The reverse: a wall-clock reading — the fields a date picker produced — and
 * the UTC instant those fields name in the clinic. Pass a `TZDate` already in
 * the clinic timezone and this is an exact round-trip of `toClinicTime`.
 */
export const fromClinicTime = (local: Date): Date =>
  new Date(
    new TZDate(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
      local.getMinutes(),
      local.getSeconds(),
      local.getMilliseconds(),
      CLINIC_TIMEZONE,
    ).getTime(),
  );

/** 00:00:00.000 on the clinic day that contains the instant. */
export const startOfClinicDay = (d: ClinicDateInput): TZDate =>
  startOfDay(toClinicTime(d));

/** 23:59:59.999 on the clinic day that contains the instant. */
export const endOfClinicDay = (d: ClinicDateInput): TZDate =>
  endOfDay(toClinicTime(d));

/** Monday 00:00:00.000 of the clinic week that contains the instant. */
export const startOfClinicWeek = (d: ClinicDateInput): TZDate =>
  startOfWeek(toClinicTime(d), { weekStartsOn: WEEK_STARTS_ON });
