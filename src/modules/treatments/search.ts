/**
 * The dossier tab's in-memory search: «detartrage» finds «Détartrage», and the
 * NGAP code matches too. Case- and accent-insensitive.
 */
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const matchesTreatmentSearch = (
  treatment: { label: string; nomenclatureCode: string | null },
  search: string,
) => {
  const needle = fold(search);
  if (!needle) return true;
  return fold(`${treatment.label} ${treatment.nomenclatureCode ?? ""}`).includes(
    needle,
  );
};
