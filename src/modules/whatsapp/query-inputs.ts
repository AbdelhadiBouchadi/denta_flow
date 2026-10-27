import { isCalendarDate } from "@/lib/time";
import type { EVENT_VALUES, STATUS_VALUES } from "./constants";

/**
 * The URL state → procedure inputs, ONCE (04-hydration.md §4 rule 11): the
 * page's prefetch and the view's query import these, so their keys can only
 * be equal. A hand-edited `?day=` that is not a calendar day reads as ""
 * (tomorrow) instead of a BAD_REQUEST.
 */

const day = (value: string) => (isCalendarDate(value) ? value : "");

export const byDayQueryInput = (filters: { day: string }) => ({
  day: day(filters.day),
});

export const journalQueryInput = (filters: {
  waFrom: string;
  waTo: string;
  waEvent: (typeof EVENT_VALUES)[number] | null;
  waStatus: (typeof STATUS_VALUES)[number] | null;
  waSearch: string;
  waPage: number;
}) => ({
  from: day(filters.waFrom),
  to: day(filters.waTo),
  event: filters.waEvent ?? null,
  status: filters.waStatus ?? null,
  q: filters.waSearch.trim().slice(0, 80),
  page: Math.max(1, filters.waPage),
});
