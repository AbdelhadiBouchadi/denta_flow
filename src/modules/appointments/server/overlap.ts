import { and, eq, gt, lt, ne } from "drizzle-orm";

import { appointments } from "@/database/schema";
import type { Interval } from "../booking";

/**
 * The application-level overlap check, in SQL — the same predicate as
 * `intervalsOverlap` and as the `appointments_practitioner_no_overlap`
 * exclusion constraint (drizzle/0001_exclusion_constraints.sql):
 *
 *   practitioner_id = :p AND status <> 'canceled'
 *   AND starts_at < :end AND ends_at > :start
 *   [AND id <> :excludeId]
 *
 * It exists for the good French message in the normal case. Under concurrency
 * it can pass for two requests at once; the constraint is what holds, and its
 * `23P01` is mapped in `errors.ts`.
 *
 * Kept free of `db` and `server-only` so its rendering is unit-tested.
 */
export const overlappingAppointment = ({
  practitionerId,
  startsAt,
  endsAt,
  excludeId,
}: Interval & { practitionerId: string; excludeId?: string }) =>
  and(
    eq(appointments.practitionerId, practitionerId),
    ne(appointments.status, "canceled"),
    lt(appointments.startsAt, endsAt),
    gt(appointments.endsAt, startsAt),
    excludeId ? ne(appointments.id, excludeId) : undefined,
  );
