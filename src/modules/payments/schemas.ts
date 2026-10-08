import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import {
  clinicInstant,
  isCalendarDate,
  WALL_CLOCK_PATTERN,
} from "@/lib/time";
import {
  PAYMENT_NOTES_MAX,
  PAYMENT_REFERENCE_MAX,
  PAYMENT_VALIDATION_MESSAGES as M,
} from "./constants";
import { PaymentMethod } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * `paidAt` travels as the clinic's wall clock — a calendar day and an "HH:mm"
 * — and becomes an instant in exactly one place, `resolvePaidAt`
 * (form-values.ts), through `clinicInstant`. No offset is computed in the
 * browser.
 */

const id = z.string().min(1, { message: "Identifiant requis" });

/** "" — what an untouched select submits — read as `null`. */
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
 * Integer centimes, strictly positive. Refunds are not in V1: a negative
 * payment is not modelled (prompts/20-paiements.md, rule 1). `null` is what a
 * cleared MoneyInput holds.
 */
export const paymentAmountSchema = z
  .number({ message: M.amountPositive })
  .nullable()
  .pipe(
    z
      .number({ message: M.amountPositive })
      .int({ message: M.amountInvalid })
      .positive({ message: M.amountPositive }),
  );

/**
 * The form. `now` is read when the schema runs, so the same schema refuses a
 * future `paidAt` in the browser and again on the server.
 */
export const paymentFormSchema = z
  .object({
    patientId: z.string().min(1, { message: M.patientRequired }),
    amountCents: paymentAmountSchema,
    method: z.enum(PaymentMethod, { message: M.methodInvalid }),
    /** "yyyy-MM-dd", a clinic calendar day. */
    paidDate: z.string().refine(isCalendarDate, { message: M.dateInvalid }),
    /** "HH:mm" on the clinic's wall clock. */
    paidTime: z
      .string()
      .refine((value) => WALL_CLOCK_PATTERN.test(value), {
        message: M.timeRequired,
      }),
    /** An optional allocation to one of the patient's actes. */
    treatmentId: optionalId,
    insurerId: optionalId,
    reference: optionalText(PAYMENT_REFERENCE_MAX, M.referenceTooLong),
    notes: optionalText(PAYMENT_NOTES_MAX, M.notesTooLong),
  })
  .superRefine((values, ctx) => {
    // Insurance ⇔ an insurer (prompts/20-paiements.md, rule 3).
    if (values.method === PaymentMethod.Insurance && !values.insurerId) {
      ctx.addIssue({
        code: "custom",
        path: ["insurerId"],
        message: M.insurerRequired,
      });
    }
    if (values.method !== PaymentMethod.Insurance && values.insurerId) {
      ctx.addIssue({
        code: "custom",
        path: ["insurerId"],
        message: M.insurerForbidden,
      });
    }
    // In the past or now, never in the future (rule 2).
    if (
      isCalendarDate(values.paidDate) &&
      WALL_CLOCK_PATTERN.test(values.paidTime) &&
      clinicInstant(values.paidDate, values.paidTime).getTime() > Date.now()
    ) {
      ctx.addIssue({ code: "custom", path: ["paidDate"], message: M.inFuture });
    }
  });

/**
 * `confirmAdvance` is the staff member's answer to `needs_confirmation`.
 * The server recomputes the balance itself; the flag only says «yes, I
 * know», it never claims anything about the balance.
 */
export const paymentCreateSchema = paymentFormSchema.and(
  z.object({ confirmAdvance: z.boolean().default(false) }),
);

/**
 * Update = form + id + version token + confirmation. `patientId` is
 * immutable: the procedure refuses a different one.
 */
export const paymentUpdateSchema = paymentCreateSchema.and(
  z.object({ id, expectedUpdatedAt: z.date() }),
);

export const paymentIdSchema = z.object({ id });

export const paymentsByPatientSchema = z.object({ patientId: id });

/**
 * The `/paiements` list. The bounds are the shared ones in src/constants.ts —
 * the nuqs parsers read the same `DEFAULT_PAGE`. `from` / `to` are clinic
 * calendar days ("" ⇒ open-ended); a malformed one is ignored.
 */
export const paymentGetManySchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().nullish(),
  method: z.enum(PaymentMethod).nullish(),
  insurerId: z.string().nullish(),
  from: z.string().default(""),
  to: z.string().default(""),
});

/** The admin header's period; both empty ⇒ the current clinic month. */
export const paymentSummarySchema = z.object({
  from: z.string().default(""),
  to: z.string().default(""),
});

/** What the form holds while it is being typed. */
export type PaymentFormValues = z.input<typeof paymentFormSchema>;
/** What the procedure receives once the schema has normalised it. */
export type PaymentValues = z.output<typeof paymentFormSchema>;
