import "server-only";

import { TRPCError } from "@trpc/server";
import { and, arrayContains, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import { patientFiles, patients, user } from "@/database/schema";
import {
  headPrivateBlob,
  isPrivateStorageConfigured,
  PRIVATE_STORAGE_NOT_CONFIGURED,
} from "@/lib/storage/private";
import { clinicInstant } from "@/lib/time";
import { logActivity } from "@/modules/activity/server/log";
import { PATIENT_FILE_SUMMARIES } from "@/modules/activity/summaries";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { isUniqueViolation } from "@/modules/documents/numbering";
import { formatPatientName } from "@/modules/patients/derived";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  IMAGE_MAX_BYTES,
  IMAGING_ACTIVITY_COPY,
  IMAGING_LIST_CAP,
  IMAGING_SERVER_ERRORS as E,
  PATIENT_FILE_KIND_VALUES,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_MAX_BYTES,
} from "../constants";
import { isPatientFilePathname } from "../files";
import {
  imagingRemoveDenial,
  imagingReadDenial,
  imagingWriteDenial,
} from "../rules";
import {
  imagingByPatientSchema,
  imagingCountsSchema,
  imagingIdSchema,
  imagingRegisterSchema,
  imagingUpdateSchema,
  type ImagingRegisterValues,
} from "../schemas";
import type { PatientFileKind } from "../types";

/**
 * Patient radiographs and photos (prompts/31). The bytes live in the PRIVATE
 * store; this router only ever handles rows, and no output carries a blob
 * pathname, URL or token — the browser reads `/api/files/{id}`.
 *
 * Authorization is checked INSIDE each procedure (the repo has no
 * role-specific tier): read / upload / edit for IMAGING_ROLES, remove for
 * the admin (`adminProcedure` + the archive rule). No staff scoping: tenancy
 * is the deployment (AGENTS.md §2).
 */

const forbidden = (message: string | null) => {
  if (message) throw new TRPCError({ code: "FORBIDDEN", message });
};

const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: E.fileNotFound });

const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: E.changedMeanwhile });

/** The patient a write is about: its name for the log, its archive flag. */
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

/** A live (not soft-deleted) file with what a write needs about its patient. */
const loadFile = async (id: string) => {
  const [file] = await db
    .select({
      id: patientFiles.id,
      kind: patientFiles.kind,
      teeth: patientFiles.teeth,
      patientId: patientFiles.patientId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      isArchived: patients.isArchived,
    })
    .from(patientFiles)
    .innerJoin(patients, eq(patients.id, patientFiles.patientId))
    .where(and(eq(patientFiles.id, id), isNull(patientFiles.deletedAt)))
    .limit(1);
  if (!file) throw notFound();
  return file;
};

/**
 * Optimistic concurrency, as for the odontogram: `updated_at` is
 * microsecond precision, the client's token a millisecond Date — the column
 * is truncated to the token's precision so the comparison is exact.
 */
/** Same set of teeth? Both sides are stored / validated sorted. */
const sameTeeth = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((tooth, index) => tooth === b[index]);

const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${patientFiles.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

/**
 * Decision 4: the browser uploaded the bytes itself, so nothing about them
 * is trusted until the store confirms it. Each pathname must sit in THIS
 * patient's folder, be unused by any row, exist in the private store, and
 * match the declared size and type within the slice's limits. Returns the
 * stored facts — size and type as the STORE reports them.
 */
const verifyUploadedBlobs = async (input: ImagingRegisterValues) => {
  const original = input.original.pathname;
  const thumbnail = input.thumbnail?.pathname ?? null;

  if (!isPatientFilePathname(original, input.patientId)) {
    throw badRequest(E.pathnameForeign);
  }
  if (
    thumbnail !== null &&
    (thumbnail === original ||
      !isPatientFilePathname(thumbnail, input.patientId, { thumbnail: true }))
  ) {
    throw badRequest(E.pathnameForeign);
  }

  const pathnames = thumbnail ? [original, thumbnail] : [original];
  const [used] = await db
    .select({ id: patientFiles.id })
    .from(patientFiles)
    .where(
      or(
        inArray(patientFiles.blobPathname, pathnames),
        inArray(patientFiles.thumbPathname, pathnames),
      ),
    )
    .limit(1);
  if (used) throw badRequest(E.pathnameUsed);

  const [stored, storedThumb] = await Promise.all([
    headPrivateBlob(original),
    thumbnail ? headPrivateBlob(thumbnail) : Promise.resolve(null),
  ]);

  if (!stored) throw badRequest(E.blobMissing);
  if (stored.size !== input.original.sizeBytes || stored.size > IMAGE_MAX_BYTES) {
    throw badRequest(E.sizeMismatch);
  }
  if (stored.contentType !== input.original.contentType) {
    throw badRequest(E.typeMismatch);
  }

  if (thumbnail) {
    if (
      !storedThumb ||
      storedThumb.contentType !== THUMBNAIL_CONTENT_TYPE ||
      storedThumb.size > THUMBNAIL_MAX_BYTES
    ) {
      throw badRequest(E.thumbnailInvalid);
    }
  }

  return {
    blobPathname: original,
    thumbPathname: thumbnail,
    contentType: stored.contentType,
    sizeBytes: stored.size,
  };
};

export const imagingRouter = createTRPCRouter({
  /**
   * The dossier's gallery. Excludes soft-deleted rows, capped at
   * IMAGING_LIST_CAP, newest clinical date first then id for a stable order.
   * `tooth` keeps the images TAGGED with that tooth (`teeth @> '{36}'`), so an
   * untagged image never matches. Grouping is done by the client from these
   * already-ordered rows. `storageConfigured` lets the tab show «stockage
   * non configuré» instead of a grid of broken images; the rows themselves
   * are database-only.
   */
  getManyByPatient: protectedProcedure
    .input(imagingByPatientSchema)
    .query(async ({ input, ctx }) => {
      forbidden(imagingReadDenial(ctx.auth.user.role));

      const where = and(
        eq(patientFiles.patientId, input.patientId),
        isNull(patientFiles.deletedAt),
        input.kind ? eq(patientFiles.kind, input.kind) : undefined,
        input.tooth ? arrayContains(patientFiles.teeth, [input.tooth]) : undefined,
      );

      const [items, total] = await Promise.all([
        db
          .select({
            id: patientFiles.id,
            kind: patientFiles.kind,
            takenAt: patientFiles.takenAt,
            notes: patientFiles.notes,
            teeth: patientFiles.teeth,
            width: patientFiles.width,
            height: patientFiles.height,
            sizeBytes: patientFiles.sizeBytes,
            originalName: patientFiles.originalName,
            hasThumbnail: sql<boolean>`${patientFiles.thumbPathname} IS NOT NULL`,
            uploaderName: user.name,
            createdAt: patientFiles.createdAt,
            updatedAt: patientFiles.updatedAt,
          })
          .from(patientFiles)
          .leftJoin(user, eq(user.id, patientFiles.uploadedByStaffId))
          .where(where)
          .orderBy(desc(patientFiles.takenAt), desc(patientFiles.id))
          .limit(IMAGING_LIST_CAP),
        db.$count(patientFiles, where),
      ]);

      return {
        items,
        total,
        storageConfigured: isPrivateStorageConfigured(),
      };
    }),

  /**
   * The chips' counts (prompts/32, decision 3): live images of the patient,
   * in total and per kind, whatever filter is active. One GROUP BY; a kind
   * with no image reads 0, so the chips never miss a key.
   */
  getCountsByPatient: protectedProcedure
    .input(imagingCountsSchema)
    .query(async ({ input, ctx }) => {
      forbidden(imagingReadDenial(ctx.auth.user.role));

      const rows = await db
        .select({ kind: patientFiles.kind, count: count() })
        .from(patientFiles)
        .where(
          and(
            eq(patientFiles.patientId, input.patientId),
            isNull(patientFiles.deletedAt),
          ),
        )
        .groupBy(patientFiles.kind);

      const byKind = Object.fromEntries(
        PATIENT_FILE_KIND_VALUES.map((kind) => [kind, 0]),
      ) as Record<PatientFileKind, number>;
      for (const row of rows) byKind[row.kind as PatientFileKind] = row.count;

      return {
        total: rows.reduce((sum, row) => sum + row.count, 0),
        byKind,
      };
    }),

  /**
   * Records an upload the browser has finished (decision 4). Role and
   * archive first, then the store is asked (`head()`) whether the bytes are
   * really there and really what was declared. The row and its activity
   * line go in one `db.batch`. A refused register leaves an orphan blob in
   * the private store: a known limit of this branch.
   */
  register: protectedProcedure
    .input(imagingRegisterSchema)
    .mutation(async ({ input, ctx }) => {
      forbidden(imagingReadDenial(ctx.auth.user.role));
      const patient = await loadPatient(input.patientId);
      forbidden(
        imagingWriteDenial({
          role: ctx.auth.user.role,
          patientIsArchived: patient.isArchived,
        }),
      );
      if (!isPrivateStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: PRIVATE_STORAGE_NOT_CONFIGURED,
        });
      }

      const stored = await verifyUploadedBlobs(input);
      const id = nanoid();
      const staffId = ctx.auth.user.id;

      try {
        await db.batch([
          db.insert(patientFiles).values({
            id,
            patientId: input.patientId,
            kind: input.kind,
            ...stored,
            width: input.original.width,
            height: input.original.height,
            originalName: input.original.name,
            takenAt: clinicInstant(input.takenDate),
            notes: input.notes,
            teeth: input.teeth,
            uploadedByStaffId: staffId,
          }),
          logActivity({
            entityType: ActivityEntityType.PatientFile,
            entityId: id,
            action: ActivityAction.Created,
            patientId: input.patientId,
            summary: PATIENT_FILE_SUMMARIES.added(
              formatPatientName(patient),
              input.kind,
            ),
            staffId,
          }),
        ]);
      } catch (error) {
        // The same blob registered twice at once: the unique index keeps one.
        if (isUniqueViolation(error)) throw badRequest(E.pathnameUsed);
        throw error;
      }

      return { id };
    }),

  /**
   * Kind, date, note and teeth — never the file. An absent field is left as
   * stored. A stale `expectedUpdatedAt` is a CONFLICT. The guarded activity
   * line locks the row first, so the line and the change land together or
   * not at all; it names the new teeth when they changed.
   */
  update: protectedProcedure
    .input(imagingUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      forbidden(imagingReadDenial(ctx.auth.user.role));
      const file = await loadFile(input.id);
      forbidden(
        imagingWriteDenial({
          role: ctx.auth.user.role,
          patientIsArchived: file.isArchived,
        }),
      );

      const staffId = ctx.auth.user.id;
      const guarded = and(
        eq(patientFiles.id, input.id),
        isNull(patientFiles.deletedAt),
        versionMatches(input.expectedUpdatedAt),
      );
      const kind = input.kind ?? (file.kind as PatientFileKind);
      const teethChanged =
        input.teeth !== undefined && !sameTeeth(input.teeth, file.teeth);
      const summary =
        PATIENT_FILE_SUMMARIES.updated(formatPatientName(file), kind) +
        (teethChanged ? IMAGING_ACTIVITY_COPY.teethChanged(input.teeth!) : "");
      const [, [updated]] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.PatientFile,
            entityId: input.id,
            action: ActivityAction.Updated,
            patientId: file.patientId,
            summary,
            staffId,
          },
          { table: patientFiles, where: guarded },
        ),
        db
          .update(patientFiles)
          .set({
            kind: input.kind,
            takenAt:
              input.takenDate === undefined
                ? undefined
                : clinicInstant(input.takenDate),
            notes: input.notes,
            teeth: input.teeth,
            updatedAt: new Date(),
          })
          .where(guarded)
          .returning({ id: patientFiles.id, updatedAt: patientFiles.updatedAt }),
      ]);

      // Nothing matched: edited by someone else first, or removed meanwhile.
      if (!updated) {
        await loadFile(input.id); // NOT_FOUND when it was removed
        throw conflict();
      }
      return updated;
    }),

  /**
   * Soft delete (decision 6): the row leaves every list and the file route,
   * the blob stays — a later branch references files by id and must never
   * lose its image. Admin only, never on an archived dossier. Logged.
   */
  remove: adminProcedure
    .input(imagingIdSchema)
    .mutation(async ({ input, ctx }) => {
      const file = await loadFile(input.id);
      forbidden(
        imagingRemoveDenial({
          role: ctx.auth.user.role,
          patientIsArchived: file.isArchived,
        }),
      );

      const staffId = ctx.auth.user.id;
      const live = and(
        eq(patientFiles.id, input.id),
        isNull(patientFiles.deletedAt),
      );
      const [, removed] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.PatientFile,
            entityId: input.id,
            action: ActivityAction.Deleted,
            patientId: file.patientId,
            summary: PATIENT_FILE_SUMMARIES.removed(
              formatPatientName(file),
              file.kind as PatientFileKind,
            ),
            staffId,
          },
          { table: patientFiles, where: live },
        ),
        db
          .update(patientFiles)
          .set({
            deletedAt: new Date(),
            deletedByStaffId: staffId,
            updatedAt: new Date(),
          })
          .where(live)
          .returning({ id: patientFiles.id }),
      ]);

      if (removed.length === 0) throw notFound();
      return { id: input.id };
    }),
});

/**
 * For `GET /api/files/[id]` only — not a procedure: the browser loads it as
 * an `<img>` source. A live file's stored pathnames and what its download
 * name is built from; `null` for an unknown or soft-deleted id. The route
 * checks the session and the role BEFORE calling this.
 */
export const readFileForDelivery = async (id: string) => {
  const [file] = await db
    .select({
      kind: patientFiles.kind,
      blobPathname: patientFiles.blobPathname,
      thumbPathname: patientFiles.thumbPathname,
      contentType: patientFiles.contentType,
      takenAt: patientFiles.takenAt,
      firstName: patients.firstName,
      lastName: patients.lastName,
    })
    .from(patientFiles)
    .innerJoin(patients, eq(patients.id, patientFiles.patientId))
    .where(and(eq(patientFiles.id, id), isNull(patientFiles.deletedAt)))
    .limit(1);
  if (!file) return null;
  return file;
};

/**
 * For `POST /api/files/upload` only: whether a patient exists and is not
 * archived, before a token is signed for its folder.
 */
export const readPatientForUpload = async (patientId: string) => {
  const [patient] = await db
    .select({ isArchived: patients.isArchived })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) return null;
  return patient;
};
