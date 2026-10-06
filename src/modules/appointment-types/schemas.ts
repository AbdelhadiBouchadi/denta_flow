import { z } from "zod";

import { PALETTE_COLORS } from "@/components/shared/color-palette";
import {
  APPOINTMENT_TYPE_DURATION_MAX,
  APPOINTMENT_TYPE_DURATION_MIN,
  APPOINTMENT_TYPE_LABEL_MAX,
  APPOINTMENT_TYPE_VALIDATION_MESSAGES as M,
} from "./constants";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 */

const id = z.string().min(1);

export const appointmentTypeFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: M.labelRequired })
    .max(APPOINTMENT_TYPE_LABEL_MAX, { message: M.labelTooLong }),
  // The palette only — never a free hex (prompts/15-types-rdv-horaires.md).
  color: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(PALETTE_COLORS, { message: M.colorInvalid })),
  // An emptied number input arrives as NaN.
  defaultDurationMinutes: z
    .number({ message: M.durationInvalid })
    .int({ message: M.durationInvalid })
    .min(APPOINTMENT_TYPE_DURATION_MIN, { message: M.durationInvalid })
    .max(APPOINTMENT_TYPE_DURATION_MAX, { message: M.durationInvalid }),
});

export const appointmentTypeUpdateSchema = appointmentTypeFormSchema.extend({
  id,
});

export const appointmentTypeIdSchema = z.object({ id });

export type AppointmentTypeValues = z.output<typeof appointmentTypeFormSchema>;
/** What the form holds before the schema has normalised it. */
export type AppointmentTypeFormValues = z.input<
  typeof appointmentTypeFormSchema
>;
