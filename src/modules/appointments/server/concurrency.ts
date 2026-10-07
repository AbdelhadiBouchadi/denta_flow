import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

import { appointments } from "@/database/schema";
import {
  APPOINTMENT_SERVER_ERRORS,
  illegalTransitionMessage,
} from "../constants";
import { canTransition } from "../status";
import type { AppointmentStatus } from "../types";

/**
 * Optimistic concurrency for appointment writes. Neon HTTP has no
 * interactive transaction (01-database.md §1), so a write cannot lock the
 * row it read: instead every guarded write carries its precondition in its
 * own WHERE, and an empty RETURNING means the precondition no longer held.
 *
 * Free of `db` and `server-only`: the decisions here run against any store,
 * which is what lets Vitest exercise them without a database.
 */

// ── The version token ───────────────────────────────────────────────────────

/**
 * `updated_at` is `timestamp DEFAULT now()` — MICROsecond precision — while
 * the token the client holds is a JS Date, MILLIsecond precision: the driver
 * value "…:00.123456" reaches the browser as ".123". Comparing the column
 * as-is would fail for every row whose `updated_at` came from `now()` (247
 * of 249 rows when this was written), so the column is truncated to the
 * Date's own precision. Both sides truncate — Postgres's `date_trunc` and
 * V8's Date parser — so the comparison is exact, never rounded.
 *
 * The column has no time zone: the ISO string's «Z» is dropped by the
 * `::timestamp` cast, which is exactly the UTC wall time drizzle wrote and
 * read back (`mapFromDriverValue` appends "+0000").
 */
export const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${appointments.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

// ── Guarded writes ──────────────────────────────────────────────────────────

const notFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: APPOINTMENT_SERVER_ERRORS.notFound,
  });

/**
 * Runs a conditional write. A row back ⇒ saved. Nothing back ⇒ either the
 * row is gone (NOT_FOUND) or its precondition failed because someone else
 * wrote first (CONFLICT). The re-select only tells those two apart; it never
 * decides whether the write was allowed — the WHERE already did.
 */
export const guardedWrite = async <Row>({
  write,
  exists,
  conflictMessage,
}: {
  write: () => Promise<Row | undefined>;
  exists: () => Promise<boolean>;
  conflictMessage: string;
}): Promise<Row> => {
  const written = await write();
  if (written) return written;
  if (!(await exists())) throw notFound();
  throw new TRPCError({ code: "CONFLICT", message: conflictMessage });
};

/** What `changeStatus` needs from storage — drizzle in prod, memory in tests. */
export interface AppointmentStatusStore<Row> {
  readStatus: (id: string) => Promise<AppointmentStatus | null>;
  /** UPDATE … SET status = :to WHERE id = :id AND status = :from RETURNING * */
  writeStatusIf: (
    id: string,
    from: AppointmentStatus,
    to: AppointmentStatus,
  ) => Promise<Row | undefined>;
  exists: (id: string) => Promise<boolean>;
}

/**
 * The status machine's write. The transition is checked against the status
 * just read, and the write only lands while the row still HAS that status —
 * so two people moving the same `planned` appointment at once cannot both
 * succeed: the second one's WHERE matches nothing and it gets CONFLICT.
 */
export const changeStatus = async <Row>(
  store: AppointmentStatusStore<Row>,
  id: string,
  to: AppointmentStatus,
): Promise<Row> => {
  const from = await store.readStatus(id);
  if (from === null) throw notFound();

  if (!canTransition(from, to)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: illegalTransitionMessage(from, to),
    });
  }

  return guardedWrite({
    write: () => store.writeStatusIf(id, from, to),
    exists: () => store.exists(id),
    conflictMessage: APPOINTMENT_SERVER_ERRORS.statusChangedMeanwhile,
  });
};
