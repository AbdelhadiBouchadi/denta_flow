import { DEFAULT_PAGE } from "@/constants";

/**
 * Pure pagination rules for the `/rendez-vous` list, shared by the procedure,
 * the view and the header. The page size bounds live in `src/constants.ts`,
 * read by both the Zod input and the nuqs parsers.
 */

/** The LIMIT / OFFSET of a 1-based page. */
export const pageWindow = (page: number, pageSize: number) => ({
  limit: pageSize,
  offset: (Math.max(page, DEFAULT_PAGE) - 1) * pageSize,
});

export const totalPagesFor = (total: number, pageSize: number) =>
  Math.ceil(total / pageSize);

/**
 * The page to show once the total is known. A page past the end — the last
 * row of the last page was just deleted, or a stale link — falls back to the
 * last page; an empty list is page 1.
 */
export const clampPage = (page: number, totalPages: number) =>
  Math.min(Math.max(page, DEFAULT_PAGE), Math.max(totalPages, DEFAULT_PAGE));

/**
 * Every filter, range or view change narrows or moves the result set, so it
 * sends the list back to page 1 — otherwise a 3-row filter lands on an empty
 * page 4 (05-slice.md §4).
 */
export const withPageReset = <T extends object>(next: T) => ({
  ...next,
  page: DEFAULT_PAGE,
});
