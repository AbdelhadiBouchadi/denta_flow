// Public surface of the vendored calendar. Inside this folder files import
// each other directly, never through this barrel (it would be circular).
// Outside it, only src/modules/appointments/ui/calendar-adapter.ts may import
// the types; views import `EventCalendar` and nothing else.

export { EventCalendar } from "./event-calendar";
export type { CalendarDialogState, EventCalendarProps } from "./event-calendar";
export type { CalendarEvent, CalendarView, EventColor } from "./types";
