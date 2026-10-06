"use client";

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import {
  APPOINTMENT_STATUS_VALUES,
  CALENDAR_VIEW_VALUES,
  DEFAULT_CALENDAR_VIEW,
} from "../constants";

/**
 * CLIENT half of the appointments URL state — it MIRRORS params.ts exactly.
 * Changing a parser here without changing it there means the server
 * prefetches one cache entry and the client subscribes to another: no error,
 * just the wrong week of appointments.
 */
export const useAppointmentsFilters = () =>
  useQueryStates({
    date: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    view: parseAsStringLiteral(CALENDAR_VIEW_VALUES)
      .withDefault(DEFAULT_CALENDAR_VIEW)
      .withOptions({ clearOnDefault: true }),
    practitionerId: parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true }),
    status: parseAsStringLiteral(APPOINTMENT_STATUS_VALUES).withOptions({
      clearOnDefault: true,
    }),
    patientId: parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true }),
    page: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
