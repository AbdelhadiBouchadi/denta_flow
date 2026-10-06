import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6).
 */
export type ServiceGetMany =
  inferRouterOutputs<AppRouter>["services"]["getMany"]["items"];

/** One catalogue row, with its NGAP details looked up by code. */
export type ServiceListItem = ServiceGetMany[number];

/** One act of the nomenclature as `services.searchNgap` returns it. */
export type NgapSearchItem =
  inferRouterOutputs<AppRouter>["services"]["searchNgap"]["items"][number];

/** Mirrors the `service_category` pgEnum, kept in lockstep (schemas.test.ts). */
export enum ServiceCategory {
  Consultation = "consultation",
  Restorative = "restorative",
  Endodontics = "endodontics",
  Prosthetics = "prosthetics",
  Surgery = "surgery",
  Orthodontics = "orthodontics",
  Periodontics = "periodontics",
  Implantology = "implantology",
  Cosmetic = "cosmetic",
  Other = "other",
}

/** The list's `?status=` filter. English keys, they are URL values (AGENTS.md §5). */
export enum ServiceStatusFilter {
  All = "all",
  Active = "active",
  Inactive = "inactive",
}

/** `xrayRequired` in ngap-acts.json. */
export enum NgapXrayRequirement {
  Pre = "pre",
  PrePost = "pre_post",
}

/**
 * One source for the nuqs parsers (params.ts and the filters hook) and the Zod
 * inputs — the same lists on both sides of the query key.
 */
export const SERVICE_CATEGORY_VALUES = Object.values(ServiceCategory);
export const SERVICE_STATUS_FILTER_VALUES = Object.values(ServiceStatusFilter);
