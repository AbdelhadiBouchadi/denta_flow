"use client";

import { parseAsString, useQueryStates } from "nuqs";

/**
 * CLIENT half of the /parametres URL state — it MIRRORS params.ts exactly.
 * The active settings section lives here and nowhere else (AGENTS.md §8 #22).
 */
export const useClinicFilters = () =>
  useQueryStates({
    section: parseAsString
      .withDefault("general")
      .withOptions({ clearOnDefault: true }),
  });
