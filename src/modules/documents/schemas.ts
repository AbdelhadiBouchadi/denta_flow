import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { isCalendarDate, toClinicDate } from "@/lib/time";
import {
  DOCUMENT_MAX_LINES,
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

export type GenerateInvoiceValues = z.output<typeof generateInvoiceSchema>;
export type GenerateQuoteValues = z.output<typeof generateQuoteSchema>;
