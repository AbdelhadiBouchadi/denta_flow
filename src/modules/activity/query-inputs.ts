/**
 * The query inputs of `/activite`, derived from the URL state by ONE
 * function that both `page.tsx` (prefetch) and the view (subscribe) import —
 * the input is the query key, and computing it twice is how a prefetch
 * silently misses (04-hydration.md §4 rules 2 and 11).
 */

interface ActivityFilters {
  date: string;
  staff: string;
}

export const activityQueryInputs = ({ date, staff }: ActivityFilters) => ({
  day: { date, staffId: staff },
  counts: { weekOf: date, staffId: staff },
});

/** Shared by the prefetch and the view: the next page is the last cursor. */
export const getNextActivityCursor = (lastPage: { nextCursor: string | null }) =>
  lastPage.nextCursor;
