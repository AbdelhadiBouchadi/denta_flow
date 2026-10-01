"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DEFAULT_PATIENT_TAB, PATIENT_TAB_VALUES } from "../constants";

/**
 * The dossier's open tab, as URL state on the one `/patients/[patientId]`
 * route — not nested routes, which would mean one session read and one prefetch
 * block per tab for a single record (04-hydration.md §2).
 *
 * It is not part of `params.ts`: nothing on the server reads it, and keeping it
 * out of the filters map keeps the getMany query key free of it.
 */
export const usePatientTab = () =>
  useQueryState(
    "tab",
    parseAsStringLiteral(PATIENT_TAB_VALUES)
      .withDefault(DEFAULT_PATIENT_TAB)
      .withOptions({ clearOnDefault: true }),
  );
