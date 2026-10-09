import { canTransition, nextStatuses } from "@/modules/appointments/status";
import { AppointmentStatus } from "@/modules/appointments/types";
import { Greeting } from "./types";

/**
 * The dashboard's definitions (prompts/22, decision 3), as data. Free of
 * React, `db` and icons: the procedures, the view and Vitest all read them.
 *
 * - «Rendez-vous du jour»: `startsAt` in today's clinic range, `canceled`
 *   excluded. `no_show` and `completed` count — they happened today.
 * - «Restants»: `planned`, `confirmed` or `arrived` — not yet terminal,
 *   whatever the clock says.
 * - «Salle d'attente»: `arrived` AND `startsAt` in today's range.
 * - «Revenu d'aujourd'hui»: SUM(payments.amountCents) with `paidAt` in
 *   today's range, every method (src/database/sql/receivables.ts).
 */

/** The one status the day's list and counts leave out. */
export const EXCLUDED_FROM_DAY = AppointmentStatus.Canceled;

/** Still on the books today: these make the «restants». */
export const REMAINING_STATUSES = [
  AppointmentStatus.Planned,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
] as const;

/** A restant this long past its start is flagged «En retard» (display only). */
export const LATE_AFTER_MINUTES = 15;

/** «Soldes à recouvrer» lists this many patients. */
export const TOP_DEBTORS_LIMIT = 5;

/** The dashboard is left open all day: refetch this often (and on focus). */
export const DASHBOARD_REFETCH_INTERVAL_MS = 60_000;

/**
 * The legal moves that take an appointment to «En salle d’attente», read off
 * the appointments slice's transition table — never a second copy of it.
 * `confirmed` → [arrived]; `planned` → [confirmed, arrived], since the table
 * has no direct `planned → arrived` edge; anything else → [] (no button).
 * Each step is still checked by `appointments.updateStatus`.
 */
export const arrivalPath = (from: AppointmentStatus): AppointmentStatus[] => {
  if (canTransition(from, AppointmentStatus.Arrived)) {
    return [AppointmentStatus.Arrived];
  }
  const via = nextStatuses(from).find((status) =>
    canTransition(status, AppointmentStatus.Arrived),
  );
  return via ? [via, AppointmentStatus.Arrived] : [];
};

/**
 * «Bénéfice net» = revenue − charges over the same period, or `null` when
 * the period has no recorded charge (prompts/26, decision 5): a net equal to
 * the revenue would claim «no costs» when the truth is «costs not entered».
 * The view shows «Aucune charge saisie» for `null`. Never clamped: a loss is
 * a negative net.
 */
export const netProfitCents = ({
  revenueCents,
  chargesCents,
  expenseCount,
}: {
  revenueCents: number;
  chargesCents: number;
  expenseCount: number;
}): number | null =>
  expenseCount > 0 ? revenueCents - chargesCents : null;

/** Bonjour before 12:00, Bon après-midi until 18:00, Bonsoir after. */
export const greetingForHour = (hour: number): Greeting => {
  if (hour < 12) return Greeting.Morning;
  if (hour < 18) return Greeting.Afternoon;
  return Greeting.Evening;
};
