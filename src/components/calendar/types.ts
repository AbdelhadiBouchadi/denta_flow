export type CalendarView = "month" | "week" | "day" | "agenda";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: EventColor;
  location?: string;
}

/**
 * One per swatch of the app's colour palette (`components/shared/color-palette`),
 * plus `orange` for an event with no colour — so two appointment types never
 * share a block colour. Mapped from the swatch in `calendar-adapter.ts`.
 */
export type EventColor =
  | "teal"
  | "teal-dark"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "slate"
  | "gray"
  | "orange";
