import { getHours, getMinutes, isSameDay } from "date-fns";

import { EndHour, StartHour } from "./constants";
import type { CalendarEvent, EventColor } from "./types";

/**
 * Get CSS classes for event colors. Static strings, one per `EventColor`, so
 * Tailwind sees every class. Swatches of the same hue (the two teals, the two
 * slates) differ in fill strength; the slates use `zinc` for the lighter one,
 * whose neutral grey reads apart from the blue-grey `slate`.
 */
export function getEventColorClasses(color?: EventColor | string): string {
  switch (color) {
    case "teal":
      return "bg-teal-200/50 hover:bg-teal-200/40 text-teal-950/80 dark:bg-teal-400/25 dark:hover:bg-teal-400/20 dark:text-teal-200 shadow-teal-700/8";
    case "teal-dark":
      return "bg-teal-500/45 hover:bg-teal-500/35 text-teal-950 dark:bg-teal-700/50 dark:hover:bg-teal-700/40 dark:text-teal-100 shadow-teal-900/8";
    case "blue":
      return "bg-blue-200/50 hover:bg-blue-200/40 text-blue-950/80 dark:bg-blue-400/25 dark:hover:bg-blue-400/20 dark:text-blue-200 shadow-blue-700/8";
    case "green":
      return "bg-green-200/50 hover:bg-green-200/40 text-green-950/80 dark:bg-green-400/25 dark:hover:bg-green-400/20 dark:text-green-200 shadow-green-700/8";
    case "amber":
      return "bg-amber-200/50 hover:bg-amber-200/40 text-amber-950/80 dark:bg-amber-400/25 dark:hover:bg-amber-400/20 dark:text-amber-200 shadow-amber-700/8";
    case "red":
      return "bg-red-200/50 hover:bg-red-200/40 text-red-950/80 dark:bg-red-400/25 dark:hover:bg-red-400/20 dark:text-red-200 shadow-red-700/8";
    case "slate":
      return "bg-slate-400/45 hover:bg-slate-400/35 text-slate-950 dark:bg-slate-500/40 dark:hover:bg-slate-500/30 dark:text-slate-100 shadow-slate-900/8";
    case "gray":
      return "bg-zinc-200/70 hover:bg-zinc-200/55 text-zinc-900 dark:bg-zinc-400/25 dark:hover:bg-zinc-400/20 dark:text-zinc-200 shadow-zinc-700/8";
    case "orange":
    default:
      return "bg-orange-200/50 hover:bg-orange-200/40 text-orange-950/80 dark:bg-orange-400/25 dark:hover:bg-orange-400/20 dark:text-orange-200 shadow-orange-700/8";
  }
}

/**
 * Get CSS classes for border radius based on event position in multi-day events
 */
export function getBorderRadiusClasses(
  isFirstDay: boolean,
  isLastDay: boolean,
): string {
  if (isFirstDay && isLastDay) {
    return "rounded"; // Both ends rounded
  }
  if (isFirstDay) {
    return "rounded-l rounded-r-none"; // Only left end rounded
  }
  if (isLastDay) {
    return "rounded-r rounded-l-none"; // Only right end rounded
  }
  return "rounded-none"; // No rounded corners
}

/**
 * Check if an event is a multi-day event
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  // isSameDay, not getDate(): comparing day-of-month alone misses 15 Jan → 15 Feb.
  return event.allDay || !isSameDay(event.start, event.end);
}

/**
 * Filter events for a specific day
 */
export function getEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start);
      return isSameDay(day, eventStart);
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Sort events with multi-day events first, then by start time
 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aIsMultiDay = isMultiDayEvent(a);
    const bIsMultiDay = isMultiDayEvent(b);

    if (aIsMultiDay && !bIsMultiDay) return -1;
    if (!aIsMultiDay && bIsMultiDay) return 1;

    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
}

/**
 * Get multi-day events that span across a specific day (but don't start on that day)
 */
export function getSpanningEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events.filter((event) => {
    if (!isMultiDayEvent(event)) return false;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // Only include if it's not the start day but is either the end day or a middle day
    return (
      !isSameDay(day, eventStart) &&
      (isSameDay(day, eventEnd) || (day > eventStart && day < eventEnd))
    );
  });
}

/**
 * Get all events visible on a specific day (starting, ending, or spanning)
 */
export function getAllEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    return (
      isSameDay(day, eventStart) ||
      isSameDay(day, eventEnd) ||
      (day > eventStart && day < eventEnd)
    );
  });
}

/**
 * Get all events for a day (for agenda view)
 */
export function getAgendaEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return (
        isSameDay(day, eventStart) ||
        isSameDay(day, eventEnd) ||
        (day > eventStart && day < eventEnd)
      );
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Add hours to a date
 */
export function addHoursToDate(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * The hour range the week/day grid must draw for these days. The clinic day
 * (StartHour–EndHour) by default; widened to the whole hour around any timed
 * event that starts before or ends after it, so an out-of-hours appointment
 * (booked after a warning, never blocked) never falls off the grid.
 */
export function getVisibleHourRange(
  events: CalendarEvent[],
  days: Date[],
): { startHour: number; endHour: number } {
  let startHour = StartHour;
  let endHour = EndHour;

  for (const event of events) {
    if (isMultiDayEvent(event)) continue;
    if (!days.some((day) => isSameDay(day, event.start))) continue;

    startHour = Math.min(startHour, getHours(event.start));
    endHour = Math.max(
      endHour,
      getHours(event.end) + (getMinutes(event.end) > 0 ? 1 : 0),
    );
  }

  return { endHour, startHour };
}

/**
 * Side-by-side lanes for one day's timed events, given sorted by start
 * (longest first on ties). Events that overlap — directly or through a chain —
 * form a cluster; each takes the first lane free at its start, and the whole
 * cluster shares one lane count, so it splits the column width evenly.
 * Touching intervals (10:00–10:30, 10:30–11:00) do not overlap.
 */
export function assignOverlapLanes(
  intervals: { start: Date; end: Date }[],
): { lane: number; lanes: number }[] {
  const result: { lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let clusterFirst = 0;
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const closeCluster = (until: number) => {
    for (let index = clusterFirst; index < until; index++) {
      result[index].lanes = laneEnds.length;
    }
  };

  intervals.forEach(({ start, end }, index) => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (startMs >= clusterEnd) {
      closeCluster(index);
      clusterFirst = index;
      laneEnds = [];
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMs);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endMs;
    clusterEnd = Math.max(clusterEnd, endMs);
    result.push({ lane, lanes: 0 });
  });

  closeCluster(intervals.length);
  return result;
}
