import {
  addCalendarDays,
  clinicInstant,
  toClinicDate,
  type ClinicDateInput,
} from "@/lib/time";
import { WhatsappEvent, WhatsappSkipReason } from "./types";

/**
 * When a message goes out (prompts/33, decision 3). Pure: every clinic-day
 * boundary is drawn through `TZDate` (src/lib/time.ts), so the answer is the
 * same on a UTC server, a Tokyo laptop and across Morocco's clock changes.
 */

export interface SendWindow {
  /** "HH:mm", clinic wall clock. */
  windowStart: string;
  windowEnd: string;
  /** Reminders only. */
  minLeadMinutes: number;
}

export type ScheduleResult =
  | { scheduledFor: Date }
  | { skip: WhatsappSkipReason.TooLate };

const MINUTE_MS = 60_000;

const addMinutes = (instant: Date, minutes: number) =>
  new Date(instant.getTime() + minutes * MINUTE_MS);

/** The window's two instants on the clinic day containing `instant`. */
export const windowOn = (instant: ClinicDateInput, window: SendWindow) => {
  const day = toClinicDate(instant);
  return {
    day,
    start: clinicInstant(day, window.windowStart),
    end: clinicInstant(day, window.windowEnd),
  };
};

/** Inside the window, both boundaries included. */
export const isInsideWindow = (instant: Date, window: SendWindow) => {
  const { start, end } = windowOn(instant, window);
  return instant >= start && instant <= end;
};

/** The first window opening at or after `instant`. */
export const nextWindowStart = (instant: Date, window: SendWindow) => {
  const { day, start } = windowOn(instant, window);
  if (instant <= start) return start;
  return clinicInstant(addCalendarDays(day, 1), window.windowStart);
};

const tooLate = { skip: WhatsappSkipReason.TooLate } as const;

/**
 * A reminder whose ideal moment has already passed (booked late, or a row
 * found outside the window at send time): now if allowed, otherwise the next
 * window opening if it still leaves `minLead` before the appointment.
 */
const reminderAsSoonAsPossible = (
  now: Date,
  latest: Date,
  window: SendWindow,
): ScheduleResult => {
  if (isInsideWindow(now, window)) {
    return now <= latest ? { scheduledFor: now } : tooLate;
  }
  const next = nextWindowStart(now, window);
  return next <= latest ? { scheduledFor: next } : tooLate;
};

/**
 * Confirmation, reschedule and cancellation: `target` inside the window as
 * is; outside it, the next window opening — unless that would land after the
 * appointment, in which case it goes now (the patient must know first).
 */
const afterEvent = (
  target: Date,
  startsAt: Date,
  now: Date,
  window: SendWindow,
): ScheduleResult => {
  if (startsAt <= now) return tooLate;
  const at = target < now ? now : target;
  if (isInsideWindow(at, window)) return { scheduledFor: at };
  const next = nextWindowStart(at, window);
  return next > startsAt ? { scheduledFor: at } : { scheduledFor: next };
};

export interface ComputeScheduleInput {
  event: WhatsappEvent;
  startsAt: Date;
  now: Date;
  rule: { offsetMinutes: number };
  settings: SendWindow;
  /** When the triggering change happened; defaults to `now`. */
  eventAt?: Date;
}

export const computeSchedule = ({
  event,
  startsAt,
  now,
  rule,
  settings,
  eventAt,
}: ComputeScheduleInput): ScheduleResult => {
  if (event !== WhatsappEvent.Reminder) {
    return afterEvent(
      addMinutes(eventAt ?? now, rule.offsetMinutes),
      startsAt,
      now,
      settings,
    );
  }

  const latest = addMinutes(startsAt, -settings.minLeadMinutes);
  const target = addMinutes(startsAt, -rule.offsetMinutes);
  if (target < now) return reminderAsSoonAsPossible(now, latest, settings);

  // Outside the window → the nearest boundary of the SAME clinic day.
  const { start, end } = windowOn(target, settings);
  const clamped = target < start ? start : target > end ? end : target;
  // Clamped back into the past (it is already after the window today).
  if (clamped < now) return reminderAsSoonAsPossible(now, latest, settings);
  return clamped <= latest ? { scheduledFor: clamped } : tooLate;
};

export type SendTimeDecision =
  | { send: true }
  | { reschedule: Date }
  | { skip: WhatsappSkipReason.TooLate };

/**
 * The cron's window check for a claimed row, at `now`: the same rules as
 * `computeSchedule` with the ideal moment being now.
 */
export const decideAtSendTime = ({
  event,
  startsAt,
  now,
  settings,
}: {
  event: WhatsappEvent;
  startsAt: Date;
  now: Date;
  settings: SendWindow;
}): SendTimeDecision => {
  const result =
    event === WhatsappEvent.Reminder
      ? startsAt <= now
        ? tooLate
        : reminderAsSoonAsPossible(
            now,
            addMinutes(startsAt, -settings.minLeadMinutes),
            settings,
          )
      : afterEvent(now, startsAt, now, settings);

  if ("skip" in result) return result;
  return result.scheduledFor.getTime() <= now.getTime()
    ? { send: true }
    : { reschedule: result.scheduledFor };
};
