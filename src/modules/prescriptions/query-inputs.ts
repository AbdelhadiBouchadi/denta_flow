import type { MedicationStatusFilter } from "./types";

/**
 * The `medications.getMany` input of the settings list, derived from the URL
 * state by ONE function that both `parametres/page.tsx` (prefetch) and the
 * view (subscribe) import — the input is the query key, and computing it
 * twice is how a prefetch silently misses (04-hydration.md §4).
 */
export const medicationsQueryInput = ({
  medSearch,
  medStatus,
  medPage,
}: {
  medSearch: string;
  medStatus: MedicationStatusFilter;
  medPage: number;
}) => ({ search: medSearch, status: medStatus, page: medPage });
