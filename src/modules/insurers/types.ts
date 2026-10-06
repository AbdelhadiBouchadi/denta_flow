import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6).
 */
export type InsurerGetMany =
  inferRouterOutputs<AppRouter>["insurers"]["getMany"]["items"];

/** One insurer row, inactive ones included, with its patient count. */
export type InsurerListItem = InsurerGetMany[number];
