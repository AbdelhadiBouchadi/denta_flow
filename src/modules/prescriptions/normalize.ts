/**
 * Medication names, made comparable. Pure: the procedures (create, update),
 * the seed and Vitest share it.
 *
 * - `normalizeMedicationText` is what is STORED and printed: trimmed, inner
 *   runs of whitespace collapsed to one space. The case and accents the
 *   dentist typed are kept («Paracétamol», not «PARACETAMOL»).
 * - `medicationNameKey` is the de-duplication key behind the unique index
 *   `medications_name_key_idx`: name and strength, lower-cased, accents
 *   folded, spaces collapsed. «Paracétamol 1 g» and «paracetamol  1 G» are
 *   one medication; «Amoxicilline 500 mg» and «Amoxicilline 1 g» are two.
 *   The comma and the dot of a strength are kept apart («0,12 %» ≠ «0.12 %»):
 *   guessing that they mean the same number is not this function's job.
 */

export const normalizeMedicationText = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const fold = (value: string) =>
  normalizeMedicationText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr-FR");

export const medicationNameKey = (name: string, strength: string | null) =>
  `${fold(name)}|${strength ? fold(strength) : ""}`;

/** «Amoxicilline 1 g», or the name alone. The label a picker shows. */
export const formatMedicationLabel = ({
  name,
  strength,
}: {
  name: string;
  strength: string | null;
}) => (strength ? `${name} ${strength}` : name);
