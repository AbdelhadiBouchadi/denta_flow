import { format } from "date-fns";
import type { ReactNode } from "react";

import type {
  CalendarDialogState,
  CalendarEvent,
  CalendarView as CalendarComponentView,
  EventColor,
} from "@/components/calendar";
import type { PaletteColor } from "@/components/shared/color-palette";
import { AGENDA_SLOT_MINUTES } from "@/constants";
import { fromClinicTime, toClinicTime } from "@/lib/time";
import { formatPatientName } from "@/modules/patients/derived";
import { type AppointmentListItem, CalendarView } from "../types";

/**
 * The ONLY file that knows the vendored calendar's types (07-calendar.md §5).
 * Everything crossing between `appointments.getMany` and `<EventCalendar>`
 * goes through here, both directions; if the component changes, this file
 * is the one that breaks.
 *
 * Time: the calendar has no timezone concept — it lays events out on the
 * browser's wall clock. So every `Date` handed to it is built so that its
 * LOCAL components (year … minute) equal the clinic's wall-clock reading of
 * the instant, read through `TZDate`. A viewer in Tokyo and one in Casablanca
 * both see a 09:00 appointment at 09:00. The reverse takes those local
 * components back to the instant they name in the clinic. No offset is ever
 * computed or written here.
 */

// ── Time ────────────────────────────────────────────────────────────────────

/** A UTC instant → a Date whose local fields read the clinic wall clock. */
export const toCalendarDate = (instant: Date): Date => {
  const clinic = toClinicTime(instant);
  return new Date(
    clinic.getFullYear(),
    clinic.getMonth(),
    clinic.getDate(),
    clinic.getHours(),
    clinic.getMinutes(),
    clinic.getSeconds(),
    clinic.getMilliseconds(),
  );
};

/** The reverse: a calendar Date's local fields → the clinic instant. */
export const fromCalendarDate = (local: Date): Date => fromClinicTime(local);

/** A calendar Date's local fields as the form's slot: "yyyy-MM-dd" + "HH:mm". */
const toWallClockSlot = (local: Date) => {
  // Floored to the agenda's step, as the calendar's own dialog did.
  const minutes =
    Math.floor(local.getMinutes() / AGENDA_SLOT_MINUTES) * AGENDA_SLOT_MINUTES;
  const snapped = new Date(local);
  snapped.setMinutes(minutes, 0, 0);
  return {
    date: format(snapped, "yyyy-MM-dd"),
    time: format(snapped, "HH:mm"),
  };
};

/** The URL's clinic day "yyyy-MM-dd" → the calendar's controlled `date`. */
export const toCalendarAnchor = (date: string): Date => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** The calendar's navigation `Date` → the URL's "yyyy-MM-dd". */
export const fromCalendarAnchor = (local: Date): string =>
  format(local, "yyyy-MM-dd");

// ── Views ───────────────────────────────────────────────────────────────────

const TO_COMPONENT_VIEW: Record<CalendarView, CalendarComponentView> = {
  [CalendarView.Day]: "day",
  [CalendarView.Week]: "week",
  [CalendarView.Month]: "month",
  [CalendarView.Agenda]: "agenda",
};

const FROM_COMPONENT_VIEW: Record<CalendarComponentView, CalendarView> = {
  day: CalendarView.Day,
  week: CalendarView.Week,
  month: CalendarView.Month,
  agenda: CalendarView.Agenda,
};

export const toCalendarView = (view: CalendarView) => TO_COMPONENT_VIEW[view];

export const fromCalendarView = (view: CalendarComponentView) =>
  FROM_COMPONENT_VIEW[view];

// ── Colour ──────────────────────────────────────────────────────────────────

/**
 * The colour picker's eight swatches onto the calendar's colours, one to one
 * (PATCHES.md #19): two types with different swatches never share a block
 * colour. The agenda colours by appointment type; the legend reads THIS table
 * too, so a block and its legend dot can never disagree.
 */
const SWATCH_TO_EVENT_COLOR: Record<PaletteColor, EventColor> = {
  "#0D9488": "teal", // Sarcelle
  "#0F766E": "teal-dark", // Sarcelle foncé
  "#2563EB": "blue", // Bleu
  "#16A34A": "green", // Vert
  "#D97706": "amber", // Ambre
  "#DC2626": "red", // Rouge
  "#1E293B": "slate", // Ardoise
  "#475569": "gray", // Gris ardoise
};

/** No type, or a colour that is not a palette swatch (saved before it existed). */
const FALLBACK_EVENT_COLOR: EventColor = "orange";

/** The legend dot of each calendar colour — the block's hue, solid. */
const EVENT_COLOR_DOT_CLASSES: Record<EventColor, string> = {
  teal: "bg-teal-400",
  "teal-dark": "bg-teal-700",
  blue: "bg-blue-400",
  green: "bg-green-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  slate: "bg-slate-600",
  gray: "bg-zinc-400",
  orange: "bg-orange-400",
};

const toEventColor = (hex: string | null | undefined): EventColor =>
  (hex && SWATCH_TO_EVENT_COLOR[hex.toUpperCase() as PaletteColor]) ||
  FALLBACK_EVENT_COLOR;

/** The legend's dot class for a type colour (or none). */
export const legendDotClass = (hex: string | null | undefined): string =>
  EVENT_COLOR_DOT_CLASSES[toEventColor(hex)];

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * One appointment → one calendar block. Deliberately thin: no `updatedAt`,
 * no patient, no practitioner — a drag looks the source row up by id in the
 * query data instead.
 */
export const toCalendarEvent = (item: AppointmentListItem): CalendarEvent => ({
  id: item.id,
  title: formatPatientName(item.patient),
  description: item.reason ?? undefined,
  start: toCalendarDate(item.startsAt),
  end: toCalendarDate(item.endsAt),
  color: toEventColor(item.type?.color),
});

/** A dragged block → the id it moved and the new slot on the clinic wall clock. */
export const fromCalendarMove = (event: CalendarEvent) => ({
  id: event.id,
  ...toWallClockSlot(event.start),
});

// ── Dialog ──────────────────────────────────────────────────────────────────

export type CalendarDialogIntent =
  | { kind: "closed" }
  /** The «Nouveau rendez-vous» button: nothing pre-filled but the filter. */
  | { kind: "new" }
  /** An empty slot was clicked: pre-fill its start. */
  | { kind: "slot"; date: string; time: string }
  /** An appointment was clicked. */
  | { kind: "edit"; id: string };

/** The calendar's `renderDialog` state → what our dialogs should show. */
export const toDialogIntent = ({
  event,
  isOpen,
}: Pick<CalendarDialogState, "event" | "isOpen">): CalendarDialogIntent => {
  if (!isOpen) return { kind: "closed" };
  if (event === null) return { kind: "new" };
  if (event.id === "") return { kind: "slot", ...toWallClockSlot(event.start) };
  return { kind: "edit", id: event.id };
};

/**
 * Builds the calendar's `renderDialog` from a renderer that only sees our
 * intent — so the view never names the calendar's dialog state type.
 */
export const dialogRenderer =
  (render: (intent: CalendarDialogIntent, onClose: () => void) => ReactNode) =>
  (state: CalendarDialogState): ReactNode =>
    render(toDialogIntent(state), state.onClose);
