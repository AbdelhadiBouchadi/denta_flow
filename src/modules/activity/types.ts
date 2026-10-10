import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface ActivityRow` is a bug
 * (AGENTS.md §1 rule 6).
 */
type ActivityOutputs = inferRouterOutputs<AppRouter>["activity"];

/** One line of the timeline. */
export type ActivityItem = ActivityOutputs["getDay"]["items"][number];

export type ActivityDayCounts = ActivityOutputs["getDayCounts"];

export type ActivityStaffOption = ActivityOutputs["getStaff"][number];

/**
 * What a row is about. Stored as text in `activity_log.entity_type` — values
 * written before branch 27 use the same four words.
 */
export enum ActivityEntityType {
  Appointment = "appointment",
  Treatment = "treatment",
  Payment = "payment",
  Document = "document",
}

/** What happened to it. Stored as text in `activity_log.action`. */
export enum ActivityAction {
  Created = "created",
  Updated = "updated",
  Rescheduled = "rescheduled",
  StatusChanged = "status_changed",
  Generated = "generated",
  Deleted = "deleted",
}
