"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";

import { ALL_TEETH } from "@/modules/odontogram/constants";
import {
  DEFAULT_IMAGING_GROUP_BY,
  IMAGING_GROUP_BY_VALUES,
  PATIENT_FILE_KIND_VALUES,
} from "../constants";

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
    imageTooth: parseAsStringLiteral(ALL_TEETH).withOptions({
      clearOnDefault: true,
    }),
    imageGroup: parseAsStringLiteral(IMAGING_GROUP_BY_VALUES)
      .withDefault(DEFAULT_IMAGING_GROUP_BY)
      .withOptions({ clearOnDefault: true }),
  });
