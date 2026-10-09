import { format } from "date-fns";
import { fr } from "date-fns/locale";

import type { StatusTone } from "@/components/shared/status-badge";
import {
  addCalendarDays,
  clinicInstant,
  isCalendarDate,
  toClinicDate,
  type ClinicDateInput,
} from "@/lib/time";
import { DONE_WINDOW_DAYS, TASK_COPY } from "./constants";

/**
 * The tasks slice's pure rules. The server's SQL is the source of truth for
 * `isOverdue`, `isDueToday` and the order; the functions here state the same
 * rules in TypeScript so Vitest can pin them, and so the throwaway caller
 * script can check the SQL order against them.
 *
 * Free of `db` and `server-only`: imported by the procedure, the UI and tests.
 */

/**
 * The clinic's today, "yyyy-MM-dd", for the instant `now`. Drawn on the
 * clinic's clock through `src/lib/time.ts` — never `new Date()`'s local day,
 * never SQL `CURRENT_DATE` (the database runs in UTC).
 */
export const clinicToday = (now: ClinicDateInput): string => toClinicDate(now);

interface DueFields {
  dueDate: string | null;
  isDone: boolean;
}

/**
 * Not done and due before today. Calendar-day strings compare correctly as
 * text, which is also what `due_date < $today::date` does in SQL.
 */
export const isOverdue = (task: DueFields, today: string): boolean =>
  !task.isDone && task.dueDate !== null && task.dueDate < today;

/** Due today, done or not. */
export const isDueToday = (task: DueFields, today: string): boolean =>
  task.dueDate === today;

/**
 * The first instant a done task must have been completed at to still be
 * listed: clinic midnight, `DONE_WINDOW_DAYS` clinic days before today.
 * A whole-day boundary, so the list does not shift over the course of a day.
 */
export const doneWindowStart = (today: string): Date =>
  clinicInstant(addCalendarDays(today, -DONE_WINDOW_DAYS));

// ── Order ───────────────────────────────────────────────────────────────────

interface OrderFields extends DueFields {
  id: string;
  isImportant: boolean;
  createdAt: Date;
}

const byBoolDesc = (a: boolean, b: boolean) => Number(b) - Number(a);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The open list's order, mirroring the procedure's ORDER BY:
 * important first, then overdue, then `dueDate` ascending with no date last,
 * then `createdAt`, then `id` — deterministic, never two rows tied.
 */
export const compareOpenTasks = (
  a: OrderFields,
  b: OrderFields,
  today: string,
): number =>
  byBoolDesc(a.isImportant, b.isImportant) ||
  byBoolDesc(isOverdue(a, today), isOverdue(b, today)) ||
  (a.dueDate === b.dueDate
    ? 0
    : a.dueDate === null
      ? 1
      : b.dueDate === null
        ? -1
        : byText(a.dueDate, b.dueDate)) ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  byText(a.id, b.id);

/** The done list's order: most recently completed first, then `id`. */
export const compareDoneTasks = (
  a: { id: string; completedAt: Date | null },
  b: { id: string; completedAt: Date | null },
): number =>
  (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) ||
  byText(b.id, a.id);

// ── Due-date badge ──────────────────────────────────────────────────────────

/**
 * A calendar day rendered from its own fields. The Date is built AND read in
 * the process's local zone, so the zone cancels out and the day never moves
 * — unlike `parseISO(day)` read on another clock.
 */
const formatDay = (day: string, pattern: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return format(new Date(year, month - 1, date), pattern, { locale: fr });
};

export interface DueBadge {
  tone: StatusTone;
  label: string;
}

/**
 * The row's badge from the flags the SERVER computed: overdue = danger
 * «En retard · 20 juin»; today = warning «Aujourd’hui»; any other date
 * neutral «25 juin 2026»; no date = no badge. A done task's badge is always
 * neutral — the row is muted, a tint would call for an action already taken.
 */
export const dueBadge = (task: {
  dueDate: string | null;
  isDone: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
}): DueBadge | null => {
  if (!task.dueDate || !isCalendarDate(task.dueDate)) return null;
  if (!task.isDone && task.isOverdue) {
    return {
      tone: "danger",
      label: TASK_COPY.overdue(formatDay(task.dueDate, "d MMMM")),
    };
  }
  if (!task.isDone && task.isDueToday) {
    return { tone: "warning", label: TASK_COPY.today };
  }
  return { tone: "neutral", label: formatDay(task.dueDate, "d MMMM yyyy") };
};
