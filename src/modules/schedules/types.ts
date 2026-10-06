import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6).
 */
type SchedulesOutputs = inferRouterOutputs<AppRouter>["schedules"];

export type Practitioner =
  SchedulesOutputs["getPractitioners"]["items"][number];

export type ScheduleWeek = SchedulesOutputs["getWeek"];

export type ScheduleExceptionListItem =
  SchedulesOutputs["getExceptions"]["items"][number];
