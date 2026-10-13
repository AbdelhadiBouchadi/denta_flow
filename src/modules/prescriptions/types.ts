import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Medication` is a bug
 * (AGENTS.md §1 rule 6).
 */
type Outputs = inferRouterOutputs<AppRouter>;

export type MedicationListItem =
  Outputs["medications"]["getMany"]["items"][number];

export type PrescriptionPackItem = Outputs["prescriptionPacks"]["getMany"][number];

export type PrescriptionPackLine = PrescriptionPackItem["items"][number];

/** The settings list's status filter — URL state, never stored. */
export enum MedicationStatusFilter {
  All = "all",
  Active = "active",
  Inactive = "inactive",
}

export const MEDICATION_STATUS_FILTER_VALUES = [
  MedicationStatusFilter.All,
  MedicationStatusFilter.Active,
  MedicationStatusFilter.Inactive,
] as const;
