import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6).
 */
export type TagGetMany =
  inferRouterOutputs<AppRouter>["tags"]["getMany"]["items"];

/** One tag row, with how many patients carry it. */
export type TagListItem = TagGetMany[number];
