import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6). The library's document inside
 * the envelope stays `unknown` everywhere outside the adapter.
 */
type OdontogramOutputs = inferRouterOutputs<AppRouter>["odontogram"];

/** `null` for a patient without a chart. */
export type OdontogramChart = OdontogramOutputs["getChart"];

/** Which layer the tab shows. Local UI state, never in the URL. */
export enum OdontogramLayer {
  Current = "current",
  Initial = "initial",
}
