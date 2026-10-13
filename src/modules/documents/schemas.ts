import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { isCalendarDate, toClinicDate } from "@/lib/time";
import { CERTIFICATE_RENDER_ERRORS } from "@/modules/certificates/constants";
import {
  CERTIFICATE_BODY_MAX,
  CERTIFICATE_MAX_DAYS,
  DOCUMENT_MAX_LINES,
  PRESCRIPTION_FIELD_MAX,
  PRESCRIPTION_MAX_LINES,
  DOCUMENT_VALIDATION_MESSAGES as M,
  GENERATED_DOCUMENT_TYPE_VALUES,
} from "./constants";

/**
 * One schema, two consumers: the procedure's `.input()` and the dialog. Every
 * message is rendered verbatim to a user (06-ui.md §10).
 *
 * A generation names actes by id ONLY — never an amount, a label or a
 * balance. The server reads every figure it prints from the database.
 */

const id = z.string().min(1, { message: "Identifiant requis" });

const treatmentIds = z
  .array(id)
  .min(1, { message: M.emptySelection })
  .max(DOCUMENT_MAX_LINES, { message: M.tooManyLines });

export const generateInvoiceSchema = z.object({
  patientId: z.string().min(1, { message: M.patientRequired }),
  treatmentIds,
});

/**
 * `validUntil` is a clinic calendar day, today or later. `today` is read when
 * the schema runs, on the clinic's calendar, so the browser and the server
 * refuse the same past date.
 */
export const generateQuoteSchema = generateInvoiceSchema.extend({
  validUntil: z
    .string()
    .refine(isCalendarDate, { message: M.validUntilInvalid })
    .refine((day) => day >= toClinicDate(new Date()), {
      message: M.validUntilPast,
    }),
});

export const documentIdSchema = z.object({ id });

export const documentsByPatientSchema = z.object({ patientId: id });

/**
 * The `/documents` list. The bounds are the shared ones in src/constants.ts —
 * the nuqs parsers read the same `DEFAULT_PAGE`. `from` / `to` are clinic
 * calendar days ("" ⇒ open-ended); a malformed one is ignored.
 */
export const documentGetManySchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().nullish(),
  type: z.enum(GENERATED_DOCUMENT_TYPE_VALUES).nullish(),
  from: z.string().default(""),
  to: z.string().default(""),
});

// ── Medical documents (prompts/29) ──────────────────────────────────────────
// Plain text everywhere (decision 8). The client sends what the dentist
// validated; the server adds everything identifying — patient, practitioner,
// clinic, date, number — from its own reads.

/** Trimmed; blank ⇒ null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

export const prescriptionLineSchema = z.object({
  /**
   * The catalogue entry the line started from, or absent for a free line.
   * Informational only: the snapshot copies the TEXT below and never this id.
   */
  medicationId: z.string().min(1).nullish(),
  label: z
    .string()
    .trim()
    .min(1, { message: M.labelRequired })
    .max(PRESCRIPTION_FIELD_MAX.label, { message: M.labelTooLong }),
  strength: optionalText(PRESCRIPTION_FIELD_MAX.strength, M.strengthTooLong),
  posology: z
    .string()
    .trim()
    .min(1, { message: M.posologyRequired })
    .max(PRESCRIPTION_FIELD_MAX.posology, { message: M.posologyTooLong }),
  duration: optionalText(PRESCRIPTION_FIELD_MAX.duration, M.durationTooLong),
  remark: optionalText(PRESCRIPTION_FIELD_MAX.remark, M.remarkTooLong),
});

export const generatePrescriptionSchema = z.object({
  patientId: z.string().min(1, { message: M.patientRequired }),
  lines: z
    .array(prescriptionLineSchema)
    .min(1, { message: M.linesEmpty })
    .max(PRESCRIPTION_MAX_LINES, { message: M.linesTooMany }),
  noHeader: z.boolean(),
});

const optionalDay = z
  .string()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || isCalendarDate(value), {
    message: M.dateInvalid,
  });

/**
 * `body` is the text WITH its `{{variables}}`: the server renders them from
 * its own reads (certificates/variables.ts). `days` is used only without a
 * date range — with one, the server computes it.
 */
export const generateCertificateSchema = z
  .object({
    patientId: z.string().min(1, { message: M.patientRequired }),
    templateKey: z.string().trim().min(1).max(60).nullish(),
    body: z
      .string()
      .max(CERTIFICATE_BODY_MAX, { message: M.bodyTooLong })
      .refine((body) => body.trim().length > 0, { message: M.bodyRequired }),
    startDate: optionalDay,
    endDate: optionalDay,
    days: z
      .number({ message: M.daysInvalid })
      .int({ message: M.daysInvalid })
      .min(1, { message: M.daysInvalid })
      .max(CERTIFICATE_MAX_DAYS, { message: M.daysInvalid })
      .nullish(),
    noHeader: z.boolean(),
  })
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || endDate >= startDate,
    { message: CERTIFICATE_RENDER_ERRORS.rangeInverted, path: ["endDate"] },
  );

export type GenerateInvoiceValues = z.output<typeof generateInvoiceSchema>;
export type GenerateQuoteValues = z.output<typeof generateQuoteSchema>;
export type GeneratePrescriptionInput = z.input<typeof generatePrescriptionSchema>;
export type GeneratePrescriptionValues = z.output<typeof generatePrescriptionSchema>;
export type GenerateCertificateInput = z.input<typeof generateCertificateSchema>;
export type GenerateCertificateValues = z.output<typeof generateCertificateSchema>;
