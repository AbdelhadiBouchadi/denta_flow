"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";

import { PATIENT_FILE_KIND_VALUES } from "../constants";

/**
 * CLIENT half of the «Imagerie» tab's URL state — it MIRRORS params.ts
 * exactly. Changing a parser here without changing it there means the
 * dossier page prefetches one cache entry and the tab subscribes to another.
 */
export const useImagingFilters = () =>
  useQueryStates({
    imageKind: parseAsStringLiteral(PATIENT_FILE_KIND_VALUES).withOptions({
      clearOnDefault: true,
    }),
  });
