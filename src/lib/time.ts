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

// ── Wall-clock times and calendar dates ─────────────────────────────────────
//
// A practitioner's hours are a Postgres `time` — "09:00", no date, no zone —
// and a closure is entered as calendar days. Neither is an instant until it is
// resolved against a concrete clinic day, which only happens below, through
// `TZDate`. Never compare a `time` to a `timestamptz` directly (08-clinical.md §4).

/** "HH:mm", 24-hour, 00:00 → 23:59. */
export const WALL_CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "yyyy-MM-dd", a calendar day with no zone attached. */
export const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number) => String(value).padStart(2, "0");

/** "09:30" → 570. Throws on anything that is not "HH:mm". */
export const wallClockToMinutes = (wallClock: string): number => {
  const match = WALL_CLOCK_PATTERN.exec(wallClock);
  if (!match) throw new RangeError(`Invalid wall-clock time: ${wallClock}`);
  return Number(match[1]) * 60 + Number(match[2]);
};

/** 570 → "09:30". */
export const minutesToWallClock = (minutes: number): string =>
  `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

/** "09:30" → "09:30:00", the literal a Postgres `time` column takes. */
export const toPgTime = (wallClock: string): string => {
  wallClockToMinutes(wallClock);
  return `${wallClock}:00`;
};

/** "09:30:00" (what the driver returns for a `time`) → "09:30". */
export const fromPgTime = (pgTime: string): string => {
  const wallClock = pgTime.slice(0, 5);
  wallClockToMinutes(wallClock);
  return wallClock;
};

const parseCalendarDate = (date: string) => {
  const match = CALENDAR_DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Invalid calendar date: ${date}`);
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
};

/** True for a "yyyy-MM-dd" that names a real day (no 31 February). */
export const isCalendarDate = (date: string): boolean => {
  const match = CALENDAR_DATE_PATTERN.exec(date);
  if (!match) return false;
  const { year, monthIndex, day } = parseCalendarDate(date);
  const probe = new Date(Date.UTC(year, monthIndex, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === monthIndex &&
    probe.getUTCDate() === day
  );
};

/**
 * The UTC instant at which the clinic's wall clock reads `wallClock` on
 * `date`. ("2026-03-05", "00:00") is 00:00Z (Ramadan, UTC+0);
 * ("2026-04-15", "00:00") is 23:00Z the day before (UTC+1).
 */
export const clinicInstant = (date: string, wallClock = "00:00"): Date => {
  const { year, monthIndex, day } = parseCalendarDate(date);
  const minutes = wallClockToMinutes(wallClock);
  return new Date(
    new TZDate(
      year,
      monthIndex,
      day,
      Math.floor(minutes / 60),
      minutes % 60,
      CLINIC_TIMEZONE,
    ).getTime(),
  );
};

/** Clinic-local midnight at the start of the day AFTER `date`. */
export const startOfNextClinicDay = (date: string): Date => {
  const { year, monthIndex, day } = parseCalendarDate(date);
  // TZDate rolls day + 1 over month and year ends the way Date does.
  return new Date(
    new TZDate(year, monthIndex, day + 1, CLINIC_TIMEZONE).getTime(),
  );
};

/** The clinic calendar day an instant falls on, as "yyyy-MM-dd". */
export const toClinicDate = (instant: ClinicDateInput): string => {
  const local = toClinicTime(instant);
  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`;
};

/** The clinic wall-clock reading of an instant, as "HH:mm". */
export const toClinicWallClock = (instant: ClinicDateInput): string => {
  const local = toClinicTime(instant);
  return `${pad2(local.getHours())}:${pad2(local.getMinutes())}`;
};

/** The calendar day before `date`, as "yyyy-MM-dd". Zone-free arithmetic. */
export const previousCalendarDate = (date: string): string => {
  const { year, monthIndex, day } = parseCalendarDate(date);
  const probe = new Date(Date.UTC(year, monthIndex, day - 1));
  return `${probe.getUTCFullYear()}-${pad2(probe.getUTCMonth() + 1)}-${pad2(probe.getUTCDate())}`;
};
