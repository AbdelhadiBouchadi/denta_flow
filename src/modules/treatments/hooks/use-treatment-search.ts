"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * The dossier «Actes» tab's «Rechercher par nom d'acte», as URL state (filter
 * state never lives in useState — AGENTS.md §8 #22).
 *
 * Client-only, like the dossier's `tab`: it narrows the patient's already
 * loaded actes (capped server-side) and is never part of a prefetched query
 * key, so it has no params.ts half.
 */
export const useTreatmentSearch = () =>
  useQueryState(
    "acte",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
