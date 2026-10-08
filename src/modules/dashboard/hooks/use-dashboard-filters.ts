"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  DASHBOARD_PERIOD_VALUES,
  DEFAULT_DASHBOARD_PERIOD,
} from "../constants";

/**
 * CLIENT half of `/tableau-de-bord`'s URL state — it MIRRORS params.ts
 * exactly, or the server prefetches one `getAdminStats` entry and the client
 * subscribes to another.
 */
export const useDashboardFilters = () =>
  useQueryStates({
    period: parseAsStringLiteral(DASHBOARD_PERIOD_VALUES)
      .withDefault(DEFAULT_DASHBOARD_PERIOD)
      .withOptions({ clearOnDefault: true }),
  });
