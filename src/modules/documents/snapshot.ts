import { z } from "zod";

import { isCalendarDate, toClinicDate } from "@/lib/time";
import {
  CERTIFICATE_BODY_MAX,
  CERTIFICATE_MAX_DAYS,
  PRESCRIPTION_MAX_LINES,
} from "./constants";
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
 *
 * The medical variants (prompts/29) follow the same rule: an ordonnance
 * COPIES each line's label, strength, posology, duration and remark — never a
 * medication id it would need to render — and a certificat stores its FINAL
 * rendered text. Editing a medication, deleting a pack or rewording a
 * template later changes no issued document.
 */

const text = z.string().min(1);
/** An identifier left empty in Paramètres is omitted from the page, not «—». */
const optionalText = z.string().min(1).nullable();
const instant = z.iso.datetime();
const cents = z.number().int();
const calendarDay = z.string().refine(isCalendarDate);

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
  validUntil: calendarDay,
});

// ── Medical variants (prompts/29) ───────────────────────────────────────────

/** No phone on a medical document; the age is frozen at the issue date. */
const medicalPatientSchema = z.object({
  id: text,
  shortCode: text,
  firstName: text,
  lastName: text,
  cin: optionalText,
  age: z.number().int().min(0).nullable(),
});

const medicalBaseV1 = {
  version: z.literal(1),
  number: text,
  issuedAt: instant,
  clinic: clinicSchema,
  patient: medicalPatientSchema,
  /** The signing practitioner — whoever generated it. Never absent. */
  practitioner: practitionerSchema,
  /** «Papier à en-tête»: the header block is hidden, its space kept. */
  noHeader: z.boolean(),
};

const prescriptionLineSchema = z.object({
  label: text,
  strength: optionalText,
  posology: text,
  duration: optionalText,
  remark: optionalText,
});

const prescriptionV1Schema = z.object({
  ...medicalBaseV1,
  type: z.literal(DocumentType.Prescription),
  lines: z.array(prescriptionLineSchema).min(1).max(PRESCRIPTION_MAX_LINES),
});

const certificateV1Schema = z.object({
  ...medicalBaseV1,
  type: z.literal(DocumentType.Certificate),
  /** The template it started from, for the record; null for a free text. */
  templateKey: optionalText,
  period: z.object({
    startDate: calendarDay.nullable(),
    endDate: calendarDay.nullable(),
    days: z.number().int().min(1).max(CERTIFICATE_MAX_DAYS).nullable(),
  }),
  /** The final text, variables resolved. Plain text; line breaks kept. */
  body: z.string().min(1).max(CERTIFICATE_BODY_MAX),
});

const billingSnapshotSchema = z.discriminatedUnion("type", [
  invoiceV1Schema,
  quoteV1Schema,
]);

export const documentSnapshotSchema = z.discriminatedUnion("type", [
  invoiceV1Schema,
  quoteV1Schema,
  prescriptionV1Schema,
  certificateV1Schema,
]);

export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;
export type InvoiceSnapshot = z.infer<typeof invoiceV1Schema>;
export type QuoteSnapshot = z.infer<typeof quoteV1Schema>;
export type BillingSnapshot = InvoiceSnapshot | QuoteSnapshot;
export type PrescriptionSnapshot = z.infer<typeof prescriptionV1Schema>;
export type CertificateSnapshot = z.infer<typeof certificateV1Schema>;
export type MedicalSnapshot = PrescriptionSnapshot | CertificateSnapshot;

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

const toClinicBlock = (clinic: ClinicSource) => ({
  name: clinic.name.trim(),
  address: clean(clinic.address),
  city: clean(clinic.city),
  phone: clean(clinic.phone),
  email: clean(clinic.email),
  ice: clean(clinic.ice),
  patente: clean(clinic.patente),
  fiscalId: clean(clinic.fiscalId),
  cnssNumber: clean(clinic.cnssNumber),
  inpe: clean(clinic.inpe),
  logoUrl: clean(clinic.logoUrl),
});

const toPractitionerBlock = (practitioner: PractitionerSource) => ({
  name: practitioner.name,
  title: clean(practitioner.title),
  inpe: clean(practitioner.inpe),
});

export const buildDocumentSnapshot = (
  input: BuildSnapshotInput,
): BillingSnapshot => {
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
    clinic: toClinicBlock(input.clinic),
    patient: {
      id: input.patient.id,
      shortCode: input.patient.shortCode,
      firstName: input.patient.firstName,
      lastName: input.patient.lastName,
      cin: clean(input.patient.cin),
      phone: clean(input.patient.phone),
    },
    practitioner: input.practitioner
      ? toPractitionerBlock(input.practitioner)
      : null,
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
  } as const;

  // Parsed on the way in too: a snapshot that would not render is never stored.
  return billingSnapshotSchema.parse(
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

// ── Medical builders (prompts/29) ───────────────────────────────────────────

interface MedicalPatientSource {
  id: string;
  shortCode: string;
  firstName: string;
  lastName: string;
  cin: string | null;
  /** "yyyy-MM-dd", or null when unknown. */
  birthDate: string | null;
}

/**
 * Whole years on `day` (a clinic calendar day), from the calendar strings
 * alone — no Date, so no zone can move a birthday. `null` when the birth date
 * is unknown, malformed or after `day`.
 */
export const ageOnDay = (birthDate: string | null, day: string) => {
  if (!birthDate || !isCalendarDate(birthDate) || !isCalendarDate(day)) {
    return null;
  }
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, date] = day.split("-").map(Number);
  const beforeBirthday =
    month < birthMonth || (month === birthMonth && date < birthDay);
  const age = year - birthYear - (beforeBirthday ? 1 : 0);
  return age >= 0 ? age : null;
};

interface MedicalBuildBase {
  number: string;
  issuedAt: Date;
  clinic: ClinicSource;
  patient: MedicalPatientSource;
  practitioner: PractitionerSource;
  noHeader: boolean;
}

const medicalBase = (input: MedicalBuildBase) => ({
  version: CURRENT_SNAPSHOT_VERSION,
  number: input.number,
  issuedAt: input.issuedAt.toISOString(),
  clinic: toClinicBlock(input.clinic),
  patient: {
    id: input.patient.id,
    shortCode: input.patient.shortCode,
    firstName: input.patient.firstName,
    lastName: input.patient.lastName,
    cin: clean(input.patient.cin),
    age: ageOnDay(input.patient.birthDate, toClinicDate(input.issuedAt)),
  },
  practitioner: toPractitionerBlock(input.practitioner),
  noHeader: input.noHeader,
});

export interface PrescriptionLineSource {
  label: string;
  strength?: string | null;
  posology: string;
  duration?: string | null;
  remark?: string | null;
}

/**
 * The ordonnance as printed. The lines are COPIES of what the dentist
 * validated: a line picked from the catalogue carries no medication id.
 */
export const buildPrescriptionSnapshot = (
  input: MedicalBuildBase & { lines: readonly PrescriptionLineSource[] },
): PrescriptionSnapshot =>
  prescriptionV1Schema.parse({
    ...medicalBase(input),
    type: DocumentType.Prescription,
    lines: input.lines.map((line) => ({
      label: line.label.trim(),
      strength: clean(line.strength),
      posology: line.posology.trim(),
      duration: clean(line.duration),
      remark: clean(line.remark),
    })),
  });

export interface CertificatePeriod {
  startDate: string | null;
  endDate: string | null;
  days: number | null;
}

/** The certificat as printed: `body` is already the FINAL text. */
export const buildCertificateSnapshot = (
  input: MedicalBuildBase & {
    templateKey: string | null;
    period: CertificatePeriod;
    body: string;
  },
): CertificateSnapshot =>
  certificateV1Schema.parse({
    ...medicalBase(input),
    type: DocumentType.Certificate,
    templateKey: clean(input.templateKey),
    period: input.period,
    body: input.body,
  });
