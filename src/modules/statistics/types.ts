import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written interface for a figure is a bug
 * (AGENTS.md §1 rule 6).
 */
type StatisticsOutputs = inferRouterOutputs<AppRouter>["statistics"];

export type StatisticsOverview = StatisticsOutputs["getOverview"];
export type RevenueSeries = StatisticsOutputs["getRevenueSeries"];
export type AppointmentsSeries = StatisticsOutputs["getAppointmentsSeries"];
export type PaymentMethodBreakdown =
  StatisticsOutputs["getPaymentMethodBreakdown"];
export type TopActes = StatisticsOutputs["getTopActes"];
export type ActesByCategory = StatisticsOutputs["getActesByCategory"];
export type AppointmentsDistribution =
  StatisticsOutputs["getAppointmentsDistribution"];
export type ByPractitioner = StatisticsOutputs["getByPractitioner"];
export type RevenueVsCharges = StatisticsOutputs["getRevenueVsCharges"];
export type InsurerBreakdown = StatisticsOutputs["getInsurerBreakdown"];

/** The `?period=` presets. English values, French labels (constants.ts). */
export enum StatisticsPeriod {
  ThisMonth = "this_month",
  LastMonth = "last_month",
  Last90Days = "last_90_days",
  ThisYear = "this_year",
  Last12Months = "last_12_months",
  Custom = "custom",
}

/** How a period is cut into chart points (buckets.ts). */
export enum Granularity {
  Day = "day",
  Week = "week",
  Month = "month",
}

/** «Encaissements»' two views — local state, not the URL. */
export enum RevenueView {
  ByMethod = "by_method",
  CollectedVsProduced = "collected_vs_produced",
}

/** «Actes les plus réalisés»' toggle — local state. */
export enum TopActesOrder {
  ByCount = "by_count",
  ByValue = "by_value",
}
