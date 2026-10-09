import { AppointmentStatus } from "./types";

/**
 * «Salle d’attente» (prompts/24), as data. Free of React and `db`: the
 * procedure, the list and Vitest all read it.
 *
 * Who is waiting: status `arrived` AND `startsAt` inside today's clinic day —
 * the dashboard's `isWaiting` fragment, the one SQL definition. How long:
 * since `arrivedAt`, never `updatedAt` (any edit moves it).
 */

// ── arrivedAt across a status change ────────────────────────────────────────

/**
 * What a status change does to `arrivedAt`, written in the status's own
 * UPDATE:
 *
 * - landing on `arrived` → `now`;
 * - back to `planned` / `confirmed` (a correction) → `null`;
 * - anything else (`completed`, `canceled`, `no_show`) → `undefined`, i.e.
 *   the column is left out of the SET and keeps its value: history.
 *
 * The transition matrix decides which moves are legal; this only says what
 * a legal move writes. It holds the database CHECK
 * `appointments_arrived_at_matches_status` true by construction.
 */
export const arrivedAtFor = (
  to: AppointmentStatus,
  now: Date,
): Date | null | undefined => {
  if (to === AppointmentStatus.Arrived) return now;
  if (to === AppointmentStatus.Planned || to === AppointmentStatus.Confirmed) {
    return null;
  }
  return undefined;
};

// ── Waiting time ────────────────────────────────────────────────────────────

/** From this many minutes of waiting on, the time reads as a warning. */
export const WAITING_WARNING_MINUTES = 15;
/** From this many minutes of waiting on, the time reads as urgent. */
export const WAITING_DANGER_MINUTES = 30;

/**
 * The badge and the list are left open all day: refetch this often (and on
 * window focus). The list's «attend depuis» clock ticks at the same pace.
 */
export const WAITING_ROOM_REFRESH_MS = 30_000;

const MINUTE_MS = 60_000;

/**
 * Whole minutes since the arrival, never negative — a browser clock a little
 * behind the server's would otherwise print «attend depuis -1 min».
 */
export const waitingMinutes = (arrivedAt: Date, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - arrivedAt.getTime()) / MINUTE_MS));

export type WaitingTone = "normal" | "warning" | "danger";

export const waitingTone = (minutes: number): WaitingTone => {
  if (minutes >= WAITING_DANGER_MINUTES) return "danger";
  if (minutes >= WAITING_WARNING_MINUTES) return "warning";
  return "normal";
};
