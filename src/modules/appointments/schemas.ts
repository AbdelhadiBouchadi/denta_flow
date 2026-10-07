import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { isCalendarDate, WALL_CLOCK_PATTERN } from "@/lib/time";
import {
  APPOINTMENT_DURATION_MAX,
  APPOINTMENT_DURATION_MIN,
  APPOINTMENT_VALIDATION_MESSAGES as M,
  CALENDAR_VIEW_VALUES,
  DEFAULT_CALENDAR_VIEW,
} from "./constants";
import { AppointmentStatus } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * The slot travels as the clinic's wall clock — a calendar day and an "HH:mm"
 * — and becomes an instant in exactly one place, the procedure, through
 * `clinicInstant`. No offset is ever computed in the browser.
 *
 * `status` is not here: a booking always starts `planned`, and every later
 * change goes through `updateStatus` and its transition guard.
 */

const id = z.string().min(1, { message: "Identifiant requis" });

/** Trimmed text, with "" — what an untouched input submits — read as `null`. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

export const appointmentFormSchema = z.object({
  patientId: z.string().min(1, { message: M.patientRequired }),
  practitionerId: z.string().min(1, { message: M.practitionerRequired }),
  typeId: z
    .string()
    .nullish()
    .transform((value) => (value ? value : null)),
  /** "yyyy-MM-dd", a clinic calendar day. */
  date: z.string().refine(isCalendarDate, { message: M.dateInvalid }),
  /** "HH:mm", the clinic's wall clock. */
  time: z.string().regex(WALL_CLOCK_PATTERN, { message: M.timeInvalid }),
  /**
   * Omitted ⇒ the type's `defaultDurationMinutes` (08-clinical.md §4 rule 9).
   * The form pre-fills it from the type and the staff member may override.
   * An emptied number input arrives as NaN and is rejected here.
   */
  durationMinutes: z
    .number({ message: M.durationInvalid })
    .int({ message: M.durationInvalid })
    .min(APPOINTMENT_DURATION_MIN, { message: M.durationInvalid })
    .max(APPOINTMENT_DURATION_MAX, { message: M.durationInvalid })
    .nullish(),
  reason: optionalText(200, M.reasonTooLong),
  notes: optionalText(2000, M.notesTooLong),
  /**
   * The staff member has seen the out-of-hours warning and books anyway.
   * Without it, an out-of-hours slot is answered with the warning and
   * nothing is written.
   */
  confirmOutOfHours: z.boolean().default(false),
});

/**
 * Update = form + id + version token. The fields are never redeclared
 * (05-slice.md §1).
 *
 * `expectedUpdatedAt` is the `updatedAt` the editor LOADED. The write only
 * lands while the row still carries it; anything saved in between — another
 * tab, a drag on the agenda, a status change — makes it a CONFLICT instead of
 * a silent overwrite. Not part of the form's own schema: the user never
 * types it, the form adds it from `initialValues`.
 */
export const appointmentUpdateSchema = appointmentFormSchema.extend({
  id,
  expectedUpdatedAt: z.date(),
});

export const appointmentIdSchema = z.object({ id });

export const appointmentStatusUpdateSchema = z.object({
  id,
  status: z.enum(AppointmentStatus, { message: M.statusInvalid }),
});

/**
 * The raw URL values — `date` and `view` included. The range is derived from
 * them inside the procedure by `getRangeForView`, so the query key is exactly
 * what nuqs holds on both sides.
 */
export const appointmentGetManySchema = z.object({
  /** "" or malformed ⇒ today, on the clinic's wall clock. */
  date: z.string().default(""),
  view: z.enum(CALENDAR_VIEW_VALUES).default(DEFAULT_CALENDAR_VIEW),
  practitionerId: z.string().nullish(),
  status: z.enum(AppointmentStatus).nullish(),
  patientId: z.string().nullish(),
});

/**
 * The `/rendez-vous` list: the same filters as `getMany`, plus a page. The
 * bounds are the shared ones in src/constants.ts — the nuqs parser reads the
 * same `DEFAULT_PAGE`.
 */
export const appointmentGetPageSchema = appointmentGetManySchema.extend({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export const appointmentsByPatientSchema = z.object({
  patientId: id,
});

/** What the form holds while it is being typed. */
export type AppointmentFormValues = z.input<typeof appointmentFormSchema>;
/** What the procedure receives once the schema has normalised it. */
export type AppointmentValues = z.output<typeof appointmentFormSchema>;
