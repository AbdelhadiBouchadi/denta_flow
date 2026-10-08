import { z } from "zod";

import { isCalendarDate } from "@/lib/time";
import { DocumentType } from "./types";

/**
 * The frozen content of a generated document — what `documents.snapshot`
 * holds and the ONLY thing the PDF is rendered from (prompts/21, decision 1).
 * A facture is a fiscal document: re-rendering it from live data would
 * silently rewrite it the day an acte or a price changed. Same snapshot, same
 * PDF, forever.
 *
 * Versioned: the renderer parses every row through `documentSnapshotSchema`,
 * so when the layout evolves a `version: 2` is added to the union and every
 * `version: 1` snapshot still renders.
 *
 * Instants travel as ISO strings (jsonb has no date type); calendar days as
 * "yyyy-MM-dd". Money is integer centimes, as everywhere.
 */

const text = z.string().min(1);
/** An identifier left empty in Paramètres is omitted from the page, not «—». */
const optionalText = z.string().min(1).nullable();
const instant = z.iso.datetime();
const cents = z.number().int();

const clinicSchema = z.object({
  name: text,
  address: optionalText,
  city: optionalText,
  phone: optionalText,
  email: optionalText,
  ice: optionalText,
  patente: optionalText,
  fiscalId: optionalText,
  cnssNumber: optionalText,
  inpe: optionalText,
  /** Fetched at render time; any failure falls back to a text-only header. */
  logoUrl: optionalText,
});

const patientSchema = z.object({
  id: text,
  shortCode: text,
  firstName: text,
  lastName: text,
  cin: optionalText,
  phone: optionalText,
});

const practitionerSchema = z.object({
  name: text,
  title: optionalText,
  inpe: optionalText,
});

const lineSchema = z.object({
  treatmentId: text,
  /** `performedAt`, or when the acte was recorded if it has no date yet. */
  date: instant,
  label: text,
  nomenclatureCode: optionalText,
  teeth: z.array(z.string()),
  amountCents: cents,
});

const baseV1 = {
  version: z.literal(1),
  number: text,
  issuedAt: instant,
  clinic: clinicSchema,
  patient: patientSchema,
  practitioner: practitionerSchema.nullable(),
  lines: z.array(lineSchema).min(1),
  /** The sum of `lines`, computed on the server from the database rows. */
  totalCents: cents,
};

const invoiceV1Schema = z.object({
  ...baseV1,
  type: z.literal(DocumentType.Invoice),
  /**
   * The patient ACCOUNT at the generation instant — payments land on the
   * account, not on lines (08-clinical.md §3). `remainingCents` may be
   * negative: an «Avance», never clamped.
   */
  account: z.object({
    totalBilledCents: cents,
    amountPaidCents: cents,
    remainingCents: cents,
  }),
});

const quoteV1Schema = z.object({
  ...baseV1,
  type: z.literal(DocumentType.Quote),
  /** A clinic calendar day. A devis never mentions payments. */
  validUntil: z.string().refine(isCalendarDate),
});

export const documentSnapshotSchema = z.discriminatedUnion("type", [
  invoiceV1Schema,
  quoteV1Schema,
]);

export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;
export type InvoiceSnapshot = z.infer<typeof invoiceV1Schema>;
export type QuoteSnapshot = z.infer<typeof quoteV1Schema>;

/** The version a generation writes today. */
export const CURRENT_SNAPSHOT_VERSION = 1;

// ── Builder ─────────────────────────────────────────────────────────────────
// One builder for the procedures and the seed, so seeded documents are real
// ones. Pure: the caller reads the database, this decides what is printed.

interface ClinicSource {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  ice: string | null;
  patente: string | null;
  fiscalId: string | null;
  cnssNumber: string | null;
  inpe: string | null;
  logoUrl: string | null;
}

interface PatientSource {
  id: string;
  shortCode: string;
  firstName: string;
  lastName: string;
  cin: string | null;
  phone: string | null;
}

interface PractitionerSource {
  name: string;
  title: string | null;
  inpe: string | null;
}

interface LineSource {
  id: string;
  performedAt: Date | null;
  createdAt: Date;
  label: string;
  nomenclatureCode: string | null;
  teeth: readonly string[];
  totalAmountCents: number;
}

interface BuildBase {
  number: string;
  issuedAt: Date;
  clinic: ClinicSource;
  patient: PatientSource;
  practitioner: PractitionerSource | null;
  lines: readonly LineSource[];
}

export type BuildSnapshotInput =
  | (BuildBase & {
      type: DocumentType.Invoice;
      account: {
        totalAmountCents: number;
        amountPaidCents: number;
        remainingCents: number;
      };
    })
  | (BuildBase & { type: DocumentType.Quote; validUntil: string });

/** "" and whitespace read as absent: an empty identifier is not printed. */
const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const buildDocumentSnapshot = (
  input: BuildSnapshotInput,
): DocumentSnapshot => {
  const lines = input.lines.map((line) => ({
    treatmentId: line.id,
    date: (line.performedAt ?? line.createdAt).toISOString(),
    label: line.label,
    nomenclatureCode: clean(line.nomenclatureCode),
    teeth: [...line.teeth],
    amountCents: line.totalAmountCents,
  }));

  const base = {
    version: CURRENT_SNAPSHOT_VERSION,
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    clinic: {
      name: input.clinic.name.trim(),
      address: clean(input.clinic.address),
      city: clean(input.clinic.city),
      phone: clean(input.clinic.phone),
      email: clean(input.clinic.email),
      ice: clean(input.clinic.ice),
      patente: clean(input.clinic.patente),
      fiscalId: clean(input.clinic.fiscalId),
      cnssNumber: clean(input.clinic.cnssNumber),
      inpe: clean(input.clinic.inpe),
      logoUrl: clean(input.clinic.logoUrl),
    },
    patient: {
      id: input.patient.id,
      shortCode: input.patient.shortCode,
      firstName: input.patient.firstName,
      lastName: input.patient.lastName,
      cin: clean(input.patient.cin),
      phone: clean(input.patient.phone),
    },
    practitioner: input.practitioner
      ? {
          name: input.practitioner.name,
          title: clean(input.practitioner.title),
          inpe: clean(input.practitioner.inpe),
        }
      : null,
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
  } as const;

  // Parsed on the way in too: a snapshot that would not render is never stored.
  return documentSnapshotSchema.parse(
    input.type === DocumentType.Invoice
      ? {
          ...base,
          type: input.type,
          account: {
            totalBilledCents: input.account.totalAmountCents,
            amountPaidCents: input.account.amountPaidCents,
            remainingCents: input.account.remainingCents,
          },
        }
      : { ...base, type: input.type, validUntil: input.validUntil },
  );
};

/**
 * The practitioner printed in the footer: the acte's practitioner when every
 * line shares one, else whoever generates the document (decision 9).
 */
export const pickPractitionerId = (
  lines: readonly { practitionerId: string | null }[],
  generatedById: string,
) => {
  const ids = new Set(lines.map((line) => line.practitionerId));
  const [only] = ids;
  return ids.size === 1 && only ? only : generatedById;
};
