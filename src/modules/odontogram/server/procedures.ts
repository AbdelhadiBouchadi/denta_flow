import "server-only";

import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import { odontogramCharts, patients } from "@/database/schema";
import { logActivity } from "@/modules/activity/server/log";
import { ODONTOGRAM_SUMMARIES } from "@/modules/activity/summaries";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { isUniqueViolation } from "@/modules/documents/numbering";
import { formatPatientName } from "@/modules/patients/derived";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { ODONTOGRAM_SERVER_ERRORS as E } from "../constants";
import {
  odontogramResetDenial,
  odontogramWriteDenial,
  planChartWrite,
  versionAgrees,
} from "../rules";
import { odontogramByPatientSchema, odontogramSaveSchema } from "../schemas";

/**
 * The patient's dental chart (prompts/28). One row per patient: the library
 * charts permanent and primary teeth in one document, so the row is never
 * split by `dentition` — the column keeps its default and is not read
 * (docs/spikes/odontogram.md, «Schema»).
 *
 * `initial` and `current` hold our envelope `{ version, library, data }`;
 * `data` is the library's own export and is never read here.
 */

const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: E.changedMeanwhile });

/**
 * Optimistic concurrency, as for appointments: `updated_at` is microsecond
 * precision, the client's token a millisecond Date — the column is truncated
 * to the token's precision so the comparison is exact.
 */
const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${odontogramCharts.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

/** The patient the write is about: its name for the log, its archive flag. */
const loadPatient = async (patientId: string) => {
  const [patient] = await db
    .select({
      firstName: patients.firstName,
      lastName: patients.lastName,
      isArchived: patients.isArchived,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) {
    throw new TRPCError({ code: "NOT_FOUND", message: E.patientNotFound });
  }
  return patient;
};

const loadChartRow = async (patientId: string) => {
  const [row] = await db
    .select({ id: odontogramCharts.id, updatedAt: odontogramCharts.updatedAt })
    .from(odontogramCharts)
    .where(eq(odontogramCharts.patientId, patientId))
    .limit(1);
  // Explicit: a destructured row is typed as always present, so `row ?? null`
  // would erase the null from the inferred type.
  if (!row) return null;
  return row;
};

const forbidden = (message: string | null) => {
  if (message) throw new TRPCError({ code: "FORBIDDEN", message });
};

export const odontogramRouter = createTRPCRouter({
  /**
   * Any staff member reads (decision 4). `null` for a patient without a
   * chart — a blank mouth is the starting point, not an error. Filtered by
   * the patient id only: tenancy is the deployment (AGENTS.md §2).
   */
  getChart: protectedProcedure
    .input(odontogramByPatientSchema)
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          initial: odontogramCharts.initial,
          current: odontogramCharts.current,
          updatedAt: odontogramCharts.updatedAt,
        })
        .from(odontogramCharts)
        .where(eq(odontogramCharts.patientId, input.patientId))
        .limit(1);
      // Explicit, for the inferred output type (see loadChartRow).
      if (!row) return null;
      return row;
    }),

  /**
   * Explicit save (decision 3). Role and archive checked here — the UI's
   * read-only switch is a courtesy. The first save writes `initial` and
   * `current`; later saves write `current` only. The chart and its activity
   * line go in one `db.batch`, one transaction.
   */
  saveChart: protectedProcedure
    .input(odontogramSaveSchema)
    .mutation(async ({ input, ctx }) => {
      const [patient, existing] = await Promise.all([
        loadPatient(input.patientId),
        loadChartRow(input.patientId),
      ]);
      forbidden(
        odontogramWriteDenial({
          role: ctx.auth.user.role,
          patientIsArchived: patient.isArchived,
        }),
      );
      // Created or reset by someone else since the editor loaded.
      if (!versionAgrees(existing, input.expectedUpdatedAt)) throw conflict();

      const staffId = ctx.auth.user.id;
      const summary = ODONTOGRAM_SUMMARIES.updated(formatPatientName(patient));
      // Stamped here, at the millisecond precision the token travels in.
      const now = new Date();
      const write = planChartWrite(existing, input.chart);

      if (write.kind === "insert") {
        const id = nanoid();
        try {
          await db.batch([
            db.insert(odontogramCharts).values({
              id,
              patientId: input.patientId,
              initial: write.initial,
              current: write.current,
              updatedByStaffId: staffId,
              createdAt: now,
              updatedAt: now,
            }),
            logActivity({
              entityType: ActivityEntityType.Odontogram,
              entityId: id,
              action: ActivityAction.Created,
              patientId: input.patientId,
              summary,
              staffId,
            }),
          ]);
        } catch (error) {
          // Two first saves at once: the unique index keeps one.
          if (isUniqueViolation(error)) throw conflict();
          throw error;
        }
        return { updatedAt: now };
      }

      // `versionAgrees` already refused a missing token on an existing row.
      if (!input.expectedUpdatedAt) throw conflict();
      // The guarded line locks the row; both statements require the version.
      const version = and(
        eq(odontogramCharts.id, write.id),
        versionMatches(input.expectedUpdatedAt),
      );
      const [, [updated]] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.Odontogram,
            entityId: write.id,
            action: ActivityAction.Updated,
            patientId: input.patientId,
            summary,
            staffId,
          },
          { table: odontogramCharts, where: version },
        ),
        db
          .update(odontogramCharts)
          .set({
            current: write.current,
            updatedByStaffId: staffId,
            updatedAt: now,
          })
          .where(version)
          .returning({ updatedAt: odontogramCharts.updatedAt }),
      ]);

      // Nothing matched: saved by someone else first, or reset meanwhile.
      if (!updated) throw conflict();
      return { updatedAt: now };
    }),

  /**
   * Wipes the chart — `current` AND `initial` — by deleting the row: the
   * next save is a first save again. Admin or dentist (decision 4); behind a
   * `useConfirm` naming the situation initiale in the UI. Logged.
   */
  resetChart: protectedProcedure
    .input(odontogramByPatientSchema)
    .mutation(async ({ input, ctx }) => {
      const [patient, existing] = await Promise.all([
        loadPatient(input.patientId),
        loadChartRow(input.patientId),
      ]);
      forbidden(
        odontogramResetDenial({
          role: ctx.auth.user.role,
          patientIsArchived: patient.isArchived,
        }),
      );
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: E.chartNotFound });
      }

      const where = eq(odontogramCharts.id, existing.id);
      const [, removed] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.Odontogram,
            entityId: existing.id,
            action: ActivityAction.Deleted,
            patientId: input.patientId,
            summary: ODONTOGRAM_SUMMARIES.reset(formatPatientName(patient)),
            staffId: ctx.auth.user.id,
          },
          { table: odontogramCharts, where },
        ),
        db
          .delete(odontogramCharts)
          .where(where)
          .returning({ id: odontogramCharts.id }),
      ]);

      if (removed.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: E.chartNotFound });
      }
      return { id: existing.id };
    }),
});
