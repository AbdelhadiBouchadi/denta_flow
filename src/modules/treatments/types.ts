import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Treatment` is a bug
 * (AGENTS.md §1 rule 6).
 */
type TreatmentsOutputs = inferRouterOutputs<AppRouter>["treatments"];

/** One row of `/actes`, of the dossier tab and of `getOne` — one shape. */
export type TreatmentListItem = TreatmentsOutputs["getMany"]["items"][number];

export type TreatmentGetOne = TreatmentsOutputs["getOne"];

/** The NGAP details a row carries, looked up server-side from its code. */
export type TreatmentNgap = NonNullable<TreatmentListItem["ngap"]>;

/** Mirrors the `treatment_status` pgEnum, kept in lockstep (schemas.test.ts). */
export enum TreatmentStatus {
  /** A devis / treatment plan. Shown as «Prévu», never owed. */
  Planned = "planned",
  InProgress = "in_progress",
  Completed = "completed",
  /** Never owed. Kept in the history, muted and struck through. */
  Canceled = "canceled",
}

/** The tooth grid's dentition toggle (08-clinical.md §1). */
export enum Dentition {
  Adult = "adult",
  Child = "child",
}
