"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import {
  MEDICATION_STATUS_FILTER_VALUES,
  MedicationStatusFilter,
} from "../types";

/**
 * CLIENT half of the «Médicaments et packs» list URL state — it MIRRORS
 * params.ts exactly (`npm run check:filters`).
 */
export const usePrescriptionsFilters = () =>
  useQueryStates({
    medSearch: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    medStatus: parseAsStringLiteral(MEDICATION_STATUS_FILTER_VALUES)
      .withDefault(MedicationStatusFilter.All)
      .withOptions({ clearOnDefault: true }),
    medPage: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
