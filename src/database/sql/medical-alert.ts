import { sql } from "drizzle-orm";

import { patients } from "@/database/schema";

/**
 * «Alerte médicale» — the ONE SQL definition (prompts/25, decision 1).
 *
 * True when the patient's `allergies` or `medicalNotes` holds at least one
 * non-whitespace character. `~ '\S'` rather than `btrim(x) <> ''`: `btrim`
 * strips spaces only, so a note made of a newline would have raised an alert
 * on a patient with nothing to read. NULL ⇒ no alert, never NULL itself.
 *
 * Every list where a clinician acts on a patient — the agenda, `/rendez-vous`,
 * the waiting room, today's dashboard list — selects this boolean, and NEVER
 * the text: the allergy text is read by the dossier alone. The client mirror
 * for the dossier's own badge is `hasAlertText` in src/lib/medical-alert.ts.
 *
 * Free of `db` and `server-only`: a predicate only, composed into each
 * caller's own query, which must join or select FROM `patients`.
 */
export const hasMedicalAlert = sql<boolean>`(COALESCE(${patients.allergies} ~ '\\S', FALSE) OR COALESCE(${patients.medicalNotes} ~ '\\S', FALSE))`;
