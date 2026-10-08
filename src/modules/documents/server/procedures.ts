import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import {
  activityLog,
  clinicSettings,
  documents,
  patients,
  treatments,
  user,
} from "@/database/schema";
import { env } from "@/lib/env";
import {
  clinicInstant,
  isCalendarDate,
  startOfNextClinicDay,
} from "@/lib/time";
import { formatPatientName } from "@/modules/patients/derived";
import {
  amountPaidCents as patientAmountPaidCents,
  remainingCents as patientRemainingCents,
  totalAmountCents as patientTotalAmountCents,
} from "@/modules/patients/server/procedures";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  DOCUMENT_ACTIVITY,
  DOCUMENT_NUMBER_MAX_ATTEMPTS,
  DOCUMENT_SERVER_ERRORS as E,
  PATIENT_DOCUMENTS_LIMIT,
} from "../constants";
import { buildDocumentFileName } from "../file-name";
import {
  documentNumberPrefix,
  NumberUnavailableError,
  SEQUENCE_MIN_DIGITS,
  withUniqueViolationRetry,
} from "../numbering";
import { selectDocumentLines } from "../rules";
import {
  documentGetManySchema,
  documentIdSchema,
  documentsByPatientSchema,
  generateInvoiceSchema,
  generateQuoteSchema,
} from "../schemas";
import {
  buildDocumentSnapshot,
  pickPractitionerId,
  type BuildSnapshotInput,
} from "../snapshot";
import { DocumentType, type GeneratedDocumentType } from "../types";

/**
 * The generated-documents registry. Reads are `protectedProcedure` with no
 * staff scoping — every staff member sees the whole clinic (AGENTS.md §2);
 * generating is any staff; `remove` is admin.
 *
 * A row holds an immutable JSON snapshot, never a PDF and never a pointer to
 * live data: GET /api/documents/[id] renders the snapshot on every download
 * (prompts/21, decision 1). The snapshot is built HERE, from the database —
 * the client names actes by id and nothing else.
 *
 * Every write lands with its `activityLog` row in ONE `db.batch` — one Neon
 * HTTP transaction.
 */

const ENTITY_TYPE = "document";

// ── Row shape ───────────────────────────────────────────────────────────────

/** One row shape for the list and the dossier tab. Never the snapshot. */
const selectDocuments = () =>
  db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      fileName: documents.fileName,
      createdAt: documents.createdAt,
      patientId: documents.patientId,
      patient: {
        id: patients.id,
        shortCode: patients.shortCode,
        firstName: patients.firstName,
        lastName: patients.lastName,
        isArchived: patients.isArchived,
      },
      // Audit, shown as «généré par». Joined, never used as a filter.
      generatedBy: { id: user.id, name: user.name },
    })
    .from(documents)
    .innerJoin(patients, eq(documents.patientId, patients.id))
    .leftJoin(user, eq(documents.generatedByStaffId, user.id));

/** A removed document is out of every list — and of the PDF route. */
export const isLiveDocument = isNull(documents.deletedAt);

/** Newest first; the id keeps pages stable (05-slice.md §5 rule 4). */
const DOCUMENT_LIST_ORDER = [desc(documents.createdAt), desc(documents.id)] as const;

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

/** `createdAt` within clinic calendar days; a malformed bound is ignored. */
const createdWithin = (from: string, to: string) =>
  and(
    isCalendarDate(from) ? gte(documents.createdAt, clinicInstant(from)) : undefined,
    isCalendarDate(to) ? lt(documents.createdAt, startOfNextClinicDay(to)) : undefined,
  );

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: E.notFound });
const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

// ── Generation: reading the facts ───────────────────────────────────────────

/** The clinic row, or the env name alone while Paramètres was never saved. */
const readClinic = async () => {
  const [row] = await db
    .select()
    .from(clinicSettings)
    .where(eq(clinicSettings.id, "clinic"))
    .limit(1);
  return {
    name: row?.name?.trim() || env.NEXT_PUBLIC_CLINIC_NAME,
    address: row?.address ?? null,
    city: row?.city ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    ice: row?.ice ?? null,
    patente: row?.patente ?? null,
    fiscalId: row?.fiscalId ?? null,
    cnssNumber: row?.cnssNumber ?? null,
    inpe: row?.inpe ?? null,
    logoUrl: row?.logoUrl ?? null,
  };
};

/**
 * The patient and their account, through the SAME SQL as `patients.getOne`
 * (billable actes only, payments summed, never clamped). Archived patients
 * are accepted: a final invoice is normal (decision 11).
 */
const readPatient = async (patientId: string) => {
  const [row] = await db
    .select({
      id: patients.id,
      shortCode: patients.shortCode,
      firstName: patients.firstName,
      lastName: patients.lastName,
      cin: patients.cin,
      phone: patients.phone,
      totalAmountCents: patientTotalAmountCents,
      amountPaidCents: patientAmountPaidCents,
      remainingCents: patientRemainingCents,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
};

/** The requested actes, WHATEVER their patient — the rule tells them apart. */
const readTreatments = (ids: readonly string[]) =>
  db
    .select({
      id: treatments.id,
      patientId: treatments.patientId,
      practitionerId: treatments.practitionerId,
      status: treatments.status,
      label: treatments.label,
      nomenclatureCode: treatments.nomenclatureCode,
      teeth: treatments.teeth,
      totalAmountCents: treatments.totalAmountCents,
      performedAt: treatments.performedAt,
      createdAt: treatments.createdAt,
    })
    .from(treatments)
    .where(inArray(treatments.id, [...new Set(ids)]));

const readStaff = async (id: string) => {
  const [row] = await db
    .select({ name: user.name, title: user.title, inpe: user.inpe })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
};

// ── Generation: the numbered insert ─────────────────────────────────────────
//
// Neon HTTP has no interactive transaction, so «read MAX, then insert» cannot
// span two round trips. The number is computed INSIDE the insert:
//
//   WITH next AS (SELECT prefix || '-' || lpad(MAX(seq) + 1) FROM documents …)
//   INSERT INTO documents … SELECT … FROM next
//
// MAX runs over EVERY row, removed ones included (`remove` only stamps
// `deletedAt`), so no number is ever handed out twice — not even the last one.
//
// Two concurrent generations can still compute the same number; the unique
// index on (type, number) refuses the second, its whole batch (log row
// included) rolls back, and `withUniqueViolationRetry` runs it again against
// the new MAX. The snapshot's own `number` is written by the same statement
// (`jsonb_set`), so the row and the printed number can never differ.

/** Replaced in SQL by the assigned number — the activity sentence carries it. */
const NUMBER_TOKEN = "{{number}}";

const insertNumbered = ({
  id,
  type,
  prefix,
  patientId,
  fileName,
  snapshot,
  staffId,
  issuedAt,
}: {
  id: string;
  type: GeneratedDocumentType;
  prefix: string;
  patientId: string;
  fileName: string;
  snapshot: unknown;
  staffId: string;
  issuedAt: Date;
}) => {
  const sequence = sql`COALESCE(MAX(split_part(${documents.number}, '-', 3)::int), 0) + 1`;
  return db.execute(sql`
    WITH next AS (
      SELECT ${prefix}::text || '-' ||
        lpad((${sequence})::text, GREATEST(${SEQUENCE_MIN_DIGITS}, length((${sequence})::text)), '0') AS number
      FROM ${documents}
      WHERE ${documents.type} = ${type}::document_type
        AND ${documents.number} LIKE ${`${prefix}-%`}
    )
    INSERT INTO ${documents}
      ("id", "patient_id", "type", "number", "file_name", "storage_url",
       "snapshot", "generated_by_staff_id", "created_at")
    SELECT ${id}, ${patientId}, ${type}::document_type, next.number,
      ${fileName}, NULL,
      jsonb_set(${JSON.stringify(snapshot)}::jsonb, '{number}', to_jsonb(next.number)),
      ${staffId}, ${issuedAt.toISOString()}::timestamp
    FROM next
  `);
};

/** The log row, read from the document the batch just inserted. */
const logFromDocument = (
  id: string,
  entry: { action: string; summary: string; staffId: string },
) =>
  db.insert(activityLog).select(
    db
      .select({
        id: sql<string>`${nanoid()}::text`.as("id"),
        entityType: sql<string>`${ENTITY_TYPE}::text`.as("entity_type"),
        entityId: documents.id,
        action: sql<string>`${entry.action}::text`.as("action"),
        summary: sql<string>`replace(${entry.summary}::text, ${NUMBER_TOKEN}::text, ${documents.number})`.as(
          "summary",
        ),
        staffId: sql<string>`${entry.staffId}::text`.as("staff_id"),
        createdAt: sql<Date>`now()`.as("created_at"),
      })
      .from(documents)
      .where(and(eq(documents.id, id), isLiveDocument))
      .for("update"),
  );

/** drizzle wraps driver errors; the Postgres code sits on `cause`. */
const FOREIGN_KEY_VIOLATION = "23503";
const isForeignKeyViolation = (error: unknown) => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    if ((current as Error & { code?: unknown }).code === FOREIGN_KEY_VIOLATION) {
      return true;
    }
    current = current.cause;
  }
  return false;
};

type GenerateInput =
  | { type: DocumentType.Invoice; patientId: string; treatmentIds: string[] }
  | {
      type: DocumentType.Quote;
      patientId: string;
      treatmentIds: string[];
      validUntil: string;
    };

/**
 * Reads the facts, applies the selection rule, builds the snapshot, assigns
 * the number. Returns the new document's id.
 */
const generate = async (input: GenerateInput, staffId: string) => {
  const [patient, clinic, rows] = await Promise.all([
    readPatient(input.patientId),
    readClinic(),
    readTreatments(input.treatmentIds),
  ]);
  if (!patient) {
    throw new TRPCError({ code: "NOT_FOUND", message: E.patientNotFound });
  }

  const selection = selectDocumentLines({
    type: input.type,
    patientId: patient.id,
    requestedIds: input.treatmentIds,
    rows,
  });
  if (!selection.ok) throw badRequest(E[selection.error]);

  const practitionerId = pickPractitionerId(selection.lines, staffId);
  const practitioner =
    (await readStaff(practitionerId)) ??
    (practitionerId !== staffId ? await readStaff(staffId) : null);

  // One instant for the number's year, the file name, the dates printed and
  // the row's `createdAt`.
  const issuedAt = new Date();
  const prefix = documentNumberPrefix(input.type, issuedAt);
  const base = {
    // Overwritten in SQL by the number the insert assigns.
    number: prefix,
    issuedAt,
    clinic,
    patient,
    practitioner,
    lines: selection.lines,
  };
  const build: BuildSnapshotInput =
    input.type === DocumentType.Invoice
      ? { ...base, type: input.type, account: patient }
      : { ...base, type: input.type, validUntil: input.validUntil };
  const snapshot = buildDocumentSnapshot(build);

  const fileName = buildDocumentFileName({
    type: input.type,
    firstName: patient.firstName,
    lastName: patient.lastName,
    issuedAt,
  });
  const summary = DOCUMENT_ACTIVITY.generated(
    input.type,
    NUMBER_TOKEN,
    formatPatientName(patient),
  );

  try {
    return await withUniqueViolationRetry(async () => {
      const id = nanoid();
      await db.batch([
        insertNumbered({
          id,
          type: input.type,
          prefix,
          patientId: patient.id,
          fileName,
          snapshot,
          staffId,
          issuedAt,
        }),
        logFromDocument(id, { action: "generated", summary, staffId }),
      ]);
      return { id };
    }, DOCUMENT_NUMBER_MAX_ATTEMPTS);
  } catch (error) {
    if (error instanceof NumberUnavailableError) {
      throw new TRPCError({ code: "CONFLICT", message: E.numberUnavailable });
    }
    if (isForeignKeyViolation(error)) throw badRequest(E.missingReference);
    throw error;
  }
};

// ── Download ────────────────────────────────────────────────────────────────

/**
 * What GET /api/documents/[id] serves: the stored snapshot and file name of a
 * live document, or null. The route handler checks the session first; like
 * every read here, no staff scoping.
 */
export const readDocumentForDownload = async (id: string) => {
  const [row] = await db
    .select({ fileName: documents.fileName, snapshot: documents.snapshot })
    .from(documents)
    .where(and(eq(documents.id, id), isLiveDocument))
    .limit(1);
  return row ?? null;
};

// ── Router ──────────────────────────────────────────────────────────────────

export const documentsRouter = createTRPCRouter({
  /** `/documents`, a page at a time. */
  getMany: protectedProcedure
    .input(documentGetManySchema)
    .query(async ({ input }) => {
      const { page, pageSize, type, from, to } = input;
      const search = input.search?.trim();

      // ONE predicate for the page and the count (05-slice.md §5 rule 6).
      const where = and(
        isLiveDocument,
        search
          ? or(
              ilike(documents.number, likePattern(search)),
              ilike(patients.shortCode, likePattern(search)),
              ilike(
                sql`${patients.lastName} || ' ' || ${patients.firstName}`,
                likePattern(search),
              ),
              ilike(
                sql`${patients.firstName} || ' ' || ${patients.lastName}`,
                likePattern(search),
              ),
            )
          : undefined,
        type ? eq(documents.type, type) : undefined,
        createdWithin(from, to),
      );

      const [items, [totals]] = await Promise.all([
        selectDocuments()
          .where(where)
          .orderBy(...DOCUMENT_LIST_ORDER)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: count() })
          .from(documents)
          .innerJoin(patients, eq(documents.patientId, patients.id))
          .where(where),
      ]);

      return {
        items,
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  /** The dossier's «Documents» tab: the same row shape, capped. */
  getManyByPatient: protectedProcedure
    .input(documentsByPatientSchema)
    .query(async ({ input }) => {
      const where = and(eq(documents.patientId, input.patientId), isLiveDocument);
      const [items, [totals]] = await Promise.all([
        selectDocuments()
          .where(where)
          .orderBy(...DOCUMENT_LIST_ORDER)
          .limit(PATIENT_DOCUMENTS_LIMIT),
        db.select({ count: count() }).from(documents).where(where),
      ]);
      return { items, total: totals.count, totalPages: 1 };
    }),

  /** Billable actes only; the account situation frozen with it. */
  generateInvoice: protectedProcedure
    .input(generateInvoiceSchema)
    .mutation(({ input, ctx }) =>
      generate({ ...input, type: DocumentType.Invoice }, ctx.auth.user.id),
    ),

  /** Planned actes only; never mentions payments. */
  generateQuote: protectedProcedure
    .input(generateQuoteSchema)
    .mutation(({ input, ctx }) =>
      generate({ ...input, type: DocumentType.Quote }, ctx.auth.user.id),
    ),

  // DESTRUCTIVE ⇒ admin, and the rejection comes from here, never from a
  // hidden button (AGENTS.md §2). The row is retired, not erased: it leaves
  // every list and the PDF route, but MAX(seq) still counts it, so its number
  // is never reissued (see the schema note on `documents.deletedAt`).
  remove: adminProcedure
    .input(documentIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select({
          type: documents.type,
          patient: { firstName: patients.firstName, lastName: patients.lastName },
        })
        .from(documents)
        .innerJoin(patients, eq(documents.patientId, patients.id))
        .where(and(eq(documents.id, input.id), isLiveDocument))
        .limit(1);
      if (!existing) throw notFound();

      // The log row locks the document first; the update then lands on it.
      // Both in one batch: either the document is retired with its trail, or
      // neither happens.
      const [, [removed]] = await db.batch([
        logFromDocument(input.id, {
          action: "deleted",
          summary: DOCUMENT_ACTIVITY.removed(
            existing.type as GeneratedDocumentType,
            NUMBER_TOKEN,
            formatPatientName(existing.patient),
          ),
          staffId: ctx.auth.user.id,
        }),
        db
          .update(documents)
          .set({ deletedAt: new Date(), deletedByStaffId: ctx.auth.user.id })
          .where(and(eq(documents.id, input.id), isLiveDocument))
          .returning({ id: documents.id }),
      ]);

      if (!removed) throw notFound();
      return removed;
    }),
});
