import { z } from "zod";

import { DashboardPeriod } from "./types";

/**
 * `getAdminStats`' input. The period's boundaries are computed by the
 * procedure from the clinic clock — the client sends a name, never dates.
 * `getStats` takes no input at all: the server decides what «today» is.
 */
export const adminStatsSchema = z.object({
  period: z.enum(DashboardPeriod).default(DashboardPeriod.Month),
});

export type AdminStatsInput = z.infer<typeof adminStatsSchema>;
