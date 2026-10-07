import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { isCalendarDate, WALL_CLOCK_PATTERN } from "@/lib/time";
import { ALL_TEETH } from "@/modules/odontogram/constants";
import {
  TREATMENT_CODE_MAX,
  TREATMENT_LABEL_MAX,
  TREATMENT_NOTES_MAX,
  TREATMENT_VALIDATION_MESSAGES as M,
} from "./constants";
import { normalizeTeeth } from "./teeth";
import { TreatmentStatus } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * `performedAt` travels as the clinic's wall clock — a calendar day and an
 * "HH:mm" — and becomes an instant in exactly one place, the procedure,
 * through `clinicInstant` (form-values.ts). No offset is computed in the
 * browser.
 */

const id = z.string().min(1, { message: "Identifiant requis" });

/** "" — what an untouched select or input submits — read as `null`. */
const optionalId = z
  .string()
  .nullish()
  .transform((value) => (value ? value : null));

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

/**
 * FDI codes only — a free `z.string()` for a tooth is a bug (08-clinical.md
 * §1). Empty is allowed: a consultation or a panoramic has no tooth.
 * Duplicates are dropped and the list is sorted.
 */
export const teethSchema = z
  .array(z.enum(ALL_TEETH, { message: M.toothInvalid }))
  .default([])
  .transform(normalizeTeeth);

/** Integer centimes ≥ 0. `null` is what a cleared MoneyInput holds. */
export const amountCentsSchema = z
  .number({ message: M.amountInvalid })
  .nullable()
  .pipe(
    z
      .number({ message: M.amountInvalid })
      .int({ message: M.amountInvalid })
      .min(0, { message: M.amountInvalid }),
  );

export const treatmentFormSchema = z
  .object({
    patientId: z.string().min(1, { message: M.patientRequired }),
    /** The catalogue entry the snapshot came from. Optional: free actes exist. */
    serviceId: optionalId,
    label: z
      .string()
      .trim()
      .min(1, { message: M.labelRequired })
      .max(TREATMENT_LABEL_MAX, { message: M.labelTooLong }),
    nomenclatureCode: optionalText(TREATMENT_CODE_MAX, M.codeTooLong),
    teeth: teethSchema,
    totalAmountCents: amountCentsSchema,
    status: z.enum(TreatmentStatus, { message: M.statusInvalid }),
    practitionerId: optionalId,
    appointmentId: optionalId,
    /** "yyyy-MM-dd", a clinic calendar day, or "" for none. */
    performedDate: z
      .string()
      .default("")
      .refine((value) => value === "" || isCalendarDate(value), {
        message: M.dateInvalid,
      }),
    /** "HH:mm" on the clinic's wall clock, or "" for none. */
    performedTime: z
      .string()
      .default("")
      .refine((value) => value === "" || WALL_CLOCK_PATTERN.test(value), {
        message: M.timeRequired,
      }),
    notes: optionalText(TREATMENT_NOTES_MAX, M.notesTooLong),
  })
  .superRefine((values, ctx) => {
    // Half a date is no instant: both, or neither.
    if (values.performedDate && !values.performedTime) {
      ctx.addIssue({
        code: "custom",
        path: ["performedTime"],
        message: M.timeRequired,
      });
    }
    if (values.performedTime && !values.performedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["performedDate"],
        message: M.dateRequired,
      });
    }
  });

/**
 * Update = form + id + version token. `expectedUpdatedAt` is the `updatedAt`
 * the editor LOADED: anything saved in between makes the write a CONFLICT
 * instead of a silent overwrite (the appointments' guard, branch 16).
 */
export const treatmentUpdateSchema = treatmentFormSchema.and(
  z.object({ id, expectedUpdatedAt: z.date() }),
);

export const treatmentIdSchema = z.object({ id });

/**
 * The `/actes` list. The bounds are the shared ones in src/constants.ts — the
 * nuqs parsers read the same `DEFAULT_PAGE`. `from` / `to` are clinic calendar
 * days ("" ⇒ open-ended); a malformed one is ignored, like a stale link.
 */
export const treatmentGetManySchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().nullish(),
  status: z.enum(TreatmentStatus).nullish(),
  practitionerId: z.string().nullish(),
  from: z.string().default(""),
  to: z.string().default(""),
});

export const treatmentsByPatientSchema = z.object({ patientId: id });

/** The NGAP details of a code, for the form's muted line. */
export const ngapLookupSchema = z.object({
  code: z.string().trim().max(TREATMENT_CODE_MAX),
});

/** What the form holds while it is being typed. */
export type TreatmentFormValues = z.input<typeof treatmentFormSchema>;
/** What the procedure receives once the schema has normalised it. */
export type TreatmentValues = z.output<typeof treatmentFormSchema>;
