"use client";

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { DEFAULT_PAGE } from "@/constants";
import {
  EVENT_VALUES,
  RAPPELS_FILTER_VALUES,
  STATUS_VALUES,
  TAB_VALUES,
} from "../constants";
import { RappelsFilter, WhatsappTab } from "../types";

/**
 * CLIENT half of the slice's URL state — it MIRRORS params.ts exactly.
 */
export const useWhatsappFilters = () =>
  useQueryStates({
    day: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    status: parseAsStringLiteral(RAPPELS_FILTER_VALUES)
      .withDefault(RappelsFilter.All)
      .withOptions({ clearOnDefault: true }),
    waTab: parseAsStringLiteral(TAB_VALUES)
      .withDefault(WhatsappTab.Service)
      .withOptions({ clearOnDefault: true }),
    waFrom: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    waTo: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    waEvent: parseAsStringLiteral(EVENT_VALUES).withOptions({
      clearOnDefault: true,
    }),
    waStatus: parseAsStringLiteral(STATUS_VALUES).withOptions({
      clearOnDefault: true,
    }),
    waSearch: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    waPage: parseAsInteger
      .withDefault(DEFAULT_PAGE)
      .withOptions({ clearOnDefault: true }),
  });
