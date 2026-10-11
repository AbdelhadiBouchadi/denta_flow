// No `import "server-only"`: the seed (plain `tsx`) writes its rows through
// this same function. It holds no secret — `db` reads DATABASE_URL itself —
// and no client file imports it (a `"use client"` file never imports @/database).
import { sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { db } from "@/database";
import { activityLog } from "@/database/schema";
import type { ActivityAction, ActivityEntityType } from "../types";

/**
 * THE writer of `activity_log` (prompts/27, decision 1). No slice builds an
 * `activityLog` insert by hand: they call this and put the statement it
 * returns IN THE SAME `db.batch` as the change it describes. A batch is one
 * Neon HTTP transaction, so a line can never exist without its change, nor
 * the reverse. Append-only: there is no update or delete counterpart.
 *
 * Two forms:
 *
 * - **Plain** — `logActivity(entry)`: an INSERT … VALUES. For a create: if
 *   the entity's INSERT fails, the batch fails and the line goes with it.
 *
 * - **Guarded** — `logActivity(entry, { table, where })`: an
 *   INSERT … SELECT … FROM `table` WHERE `where` FOR UPDATE. The line is
 *   written only if the entity row matches the precondition, and that row
 *   stays LOCKED until the batch commits. Put it BEFORE the guarded
 *   UPDATE / DELETE carrying the same precondition: the lock means nobody
 *   can change the row in between, so both land or neither does. A write
 *   refused as CONFLICT therefore leaves no line.
 *
 * `summary` is a French sentence from `summaries.ts` — or an SQL expression
 * when part of it is only known inside the statement (a document's number,
 * assigned by the insert).
 */
export interface ActivityEntry {
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  /** The dossier the line links to; `null` when none applies. */
  patientId: string | null;
  summary: string | SQL;
  /** From the session — the audit trail's «Par : …». */
  staffId: string | null;
  /** Defaults to the transaction's `now()`. Set by the seed only. */
  at?: Date;
}

export interface ActivityGuard {
  table: PgTable;
  where: SQL | undefined;
}

export const logActivity = (entry: ActivityEntry, guard?: ActivityGuard) => {
  const id = nanoid();

  if (!guard) {
    return db.insert(activityLog).values({
      id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary,
      staffId: entry.staffId,
      patientId: entry.patientId,
      ...(entry.at && { createdAt: entry.at }),
    });
  }

  const summary =
    typeof entry.summary === "string"
      ? sql<string>`${entry.summary}::text`
      : sql<string>`${entry.summary}`;
  // Sent as an ISO string: a bare Date parameter would be serialised in the
  // server's local zone, and `::timestamp` would keep that wall clock.
  const createdAt = entry.at
    ? sql<Date>`${entry.at.toISOString()}::timestamp`
    : sql<Date>`now()`;

  // The keys in the TABLE's column order: drizzle refuses an INSERT … SELECT
  // whose fields differ in name or order from the table definition.
  return db.insert(activityLog).select(
    db
      .select({
        id: sql<string>`${id}::text`.as("id"),
        entityType: sql<string>`${entry.entityType}::text`.as("entity_type"),
        entityId: sql<string>`${entry.entityId}::text`.as("entity_id"),
        action: sql<string>`${entry.action}::text`.as("action"),
        summary: summary.as("summary"),
        staffId: sql<string | null>`${entry.staffId}::text`.as("staff_id"),
        createdAt: createdAt.as("created_at"),
        patientId: sql<string | null>`${entry.patientId}::text`.as("patient_id"),
      })
      .from(guard.table)
      .where(guard.where)
      .for("update"),
  );
};
