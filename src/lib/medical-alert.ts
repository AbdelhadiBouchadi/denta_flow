/**
 * The client side of «Alerte médicale». The lists receive the boolean
 * computed in SQL (src/database/sql/medical-alert.ts) and never the text; the
 * dossier, which does read the text, decides here — with the same rule — so
 * the dossier and the agenda can never disagree about the same patient.
 */

/** At least one non-whitespace character: the SQL `~ '\S'`. */
export const hasAlertText = (text: string | null | undefined): text is string =>
  typeof text === "string" && /\S/.test(text);

export interface MedicalAlertDetails {
  /** Trimmed; `null` when the field is empty or whitespace only. */
  allergies: string | null;
  medicalNotes: string | null;
}

/**
 * What the dossier's «ALERTE MÉDICALE» popover prints, or `null` when there
 * is nothing to alert on — the badge then renders nothing at all.
 */
export const getMedicalAlertDetails = ({
  allergies,
  medicalNotes,
}: {
  allergies: string | null;
  medicalNotes: string | null;
}): MedicalAlertDetails | null => {
  const details = {
    allergies: hasAlertText(allergies) ? allergies.trim() : null,
    medicalNotes: hasAlertText(medicalNotes) ? medicalNotes.trim() : null,
  };
  return details.allergies || details.medicalNotes ? details : null;
};
