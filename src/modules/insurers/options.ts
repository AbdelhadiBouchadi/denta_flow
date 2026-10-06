import { INACTIVE_INSURER_SUFFIX } from "./constants";

/** The two fields option-building needs — any `getMany` row satisfies it. */
interface InsurerOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * What a patient's insurer select may offer: the active insurers, plus the one
 * the patient already carries even if it has since been deactivated.
 *
 * Without the second half, opening that patient shows an empty select, and
 * saving silently sets `insurerId` to null (prompts/13-tags-assurances.md).
 */
export const selectableInsurers = <T extends InsurerOption>(
  insurers: readonly T[],
  currentInsurerId: string | null | undefined,
): T[] =>
  insurers.filter(
    (insurer) => insurer.isActive || insurer.id === currentInsurerId,
  );

/** «CNOPS» or «CNOPS (inactive)» — the list filter keeps every insurer. */
export const insurerOptionLabel = (insurer: InsurerOption) =>
  insurer.isActive
    ? insurer.name
    : `${insurer.name} ${INACTIVE_INSURER_SUFFIX}`;
