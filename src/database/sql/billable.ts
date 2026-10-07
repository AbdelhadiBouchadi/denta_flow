import { eq, inArray } from "drizzle-orm";

import { treatments } from "@/database/schema";

/**
 * What a patient owes — the ONE definition (prompts/19-actes.md, decision 1).
 *
 * An acte is billed once it is under way or done. A `planned` acte is a
 * devis / treatment plan and is shown apart as «Prévu»; a `canceled` acte is
 * never owed. Every balance — the patients list and dossier, the actes list,
 * payments, the dashboard — sums through this predicate, so switching the rule
 * is a one-line change here.
 *
 * Free of `db` and `server-only`: a predicate only, composed into each
 * caller's own query.
 */
export const BILLABLE_TREATMENT_STATUSES: (typeof treatments.$inferSelect)["status"][] =
  ["in_progress", "completed"];

export const isBillableTreatment = inArray(
  treatments.status,
  BILLABLE_TREATMENT_STATUSES,
);

/** The «Prévu» figure: a treatment plan not started yet. Never owed. */
export const isPlannedTreatment = eq(treatments.status, "planned");
