import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";
import {
  EVENT_VALUES,
  RAPPELS_FILTER_VALUES,
  STATUS_VALUES,
  TAB_VALUES,
} from "./constants";
import { RappelsFilter, WhatsappTab } from "./types";

/**
 * SERVER half of the slice's URL state. `hooks/use-whatsapp-filters.ts`
 * declares the same keys, parsers and defaults — `npm run check:filters`
 * fails the build if they drift (05-slice.md §4).
 *
 * Two screens read it: `/rappels` (`day`, `status`) and Paramètres ›
 * WhatsApp (`waTab` and the journal's `wa*` keys). The settings keys carry
 * the `wa` prefix because /parametres shares one URL with other sections
 * («Actes» already uses `status` and `page`).
 *
 * `day` "" ⇒ tomorrow and `waFrom` / `waTo` "" ⇒ the last 7 days: resolved
 * by the procedures on the clinic clock, so the prefetch and the view share
 * one key whatever time it is in the browser.
 */
export const filterSearchParams = {
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
};

export const loadSearchParams = createLoader(filterSearchParams);
