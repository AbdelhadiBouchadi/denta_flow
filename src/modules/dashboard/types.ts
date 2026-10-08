import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. Never a hand-written interface (AGENTS.md §1 rule 6).
 */
type DashboardOutputs = inferRouterOutputs<AppRouter>["dashboard"];

export type DashboardStats = DashboardOutputs["getStats"];

export type DashboardAppointment = DashboardStats["appointments"][number];

export type DashboardDebtor = DashboardStats["topDebtors"][number];

export type DashboardAdminStats = DashboardOutputs["getAdminStats"];

/**
 * The «Encaissements» period. English keys: they are URL values and the
 * procedure input (AGENTS.md §5). Boundaries are clinic calendar days, the
 * week starting Monday — see `period.ts`.
 */
export enum DashboardPeriod {
  Today = "today",
  Week = "week",
  Month = "month",
  LastMonth = "last_month",
  Year = "year",
}

/** The banner's greeting, chosen by the clinic hour — copy in constants.ts. */
export enum Greeting {
  Morning = "morning",
  Afternoon = "afternoon",
  Evening = "evening",
}
