import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Task` is a bug
 * (AGENTS.md §1 rule 6).
 */
type TasksOutputs = inferRouterOutputs<AppRouter>["tasks"];

export type TaskGetMany = TasksOutputs["getMany"];

/** One row of either list — open and done share one shape. */
export type TaskListItem = TaskGetMany["open"][number];
