import { AGENDA_DAY_END, AGENDA_DAY_START } from "@/constants";

import type { CalendarView, EventColor } from "./types";

export const EventHeight = 24;

// Vertical gap between events in pixels - controls spacing in month view
export const EventGap = 4;

// Height of hour cells in week and day views - controls the scale of time display
export const WeekCellsHeight = 64;

// Number of days to show in the agenda view
export const AgendaDaysToShow = 30;

// "HH:mm" → whole hour. The one place the clinic's string hours become the
// integers the grid is laid out with. A non-whole end ("19:30") rounds up so
// the last half-hour stays on the grid.
const toGridHour = (value: string, round: "floor" | "ceil") => {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return round === "floor" ? hours : hours + (minutes > 0 ? 1 : 0);
};

// Start and end hours for the week and day views — the clinic day. Events
// outside it widen the grid instead of vanishing (see getVisibleHourRange).
export const StartHour = toGridHour(AGENDA_DAY_START, "floor");
export const EndHour = toGridHour(AGENDA_DAY_END, "ceil");

// Default slot when no time was picked (month-cell click, «Nouveau» button):
// the first hour of the clinic day.
export const DefaultStartHour = StartHour;
export const DefaultEndHour = StartHour + 1;

// French copy for every visible string in this folder.
export const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Mois",
  week: "Semaine",
  day: "Jour",
  agenda: "Agenda",
};

// Keyboard shortcuts (only active with `enableShortcuts`): French initials.
export const VIEW_SHORTCUTS: Record<CalendarView, string> = {
  month: "M",
  week: "S",
  day: "J",
  agenda: "A",
};

export const CALENDAR_COPY = {
  today: "Aujourd’hui",
  previous: "Précédent",
  next: "Suivant",
  newEvent: "Nouveau rendez-vous",
  allDay: "Toute la journée",
  more: "autres",
  agendaEmptyTitle: "Aucun rendez-vous",
  agendaEmptyDescription: "Aucun rendez-vous n’est prévu sur cette période.",
} as const;

export const EVENT_COLOR_LABELS: Record<EventColor, string> = {
  sky: "Bleu ciel",
  amber: "Ambre",
  violet: "Violet",
  rose: "Rose",
  emerald: "Émeraude",
  orange: "Orange",
};
