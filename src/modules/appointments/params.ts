import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";
import {
  APPOINTMENT_STATUS_VALUES,
  CALENDAR_VIEW_VALUES,
  DEFAULT_CALENDAR_VIEW,
} from "./constants";

/**
 * SERVER half of the appointments URL state. `hooks/use-appointments-filters.ts`
 * declares the same keys, the same parsers and the same defaults — they are
 * two halves of one query key, and `npm run check:filters` fails the build if
 * they drift (05-slice.md §4).
 *
 * `date` is a clinic calendar day, "" meaning today. The date RANGE is never
 * URL state: `getMany` derives it from `date` + `view` (07-calendar.md §7).
 */
export const filterSearchParams = {
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
  /** The `/rendez-vous` list's page. The agenda ignores it. */
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
