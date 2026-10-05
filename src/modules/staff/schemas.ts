import { z } from "zod";

import { STAFF_VALIDATION_MESSAGES as M } from "./constants";
import { StaffRole } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * Optional text fields normalise "" to `null`: a nullable column means "not
 * yet known", never an empty string (01-database.md §3).
 */

/** The `user.color` column: a 6-digit hex, the agenda's tint for this person. */
export const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

const id = z.string().min(1);

const profileFields = {
  name: z
    .string()
    .trim()
    .min(1, { message: M.nameRequired })
    .max(100, { message: M.nameTooLong }),
  title: optionalText(80, M.titleTooLong),
  inpe: optionalText(30, M.inpeTooLong),
  color: z
    .string()
    .trim()
    .toUpperCase()
    .regex(HEX_COLOR_PATTERN, { message: M.colorInvalid }),
};

export const staffRoleSchema = z.enum(StaffRole);

/** The profile half — what «Modifier» edits, for oneself or anyone else. */
export const staffProfileSchema = z.object(profileFields);

/**
 * Create adds the e-mail and the role. The password is never an input: the
 * server generates it (prompts/12-utilisateurs.md).
 */
export const staffInsertSchema = z.object({
  ...profileFields,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: M.emailRequired })
    .pipe(z.email({ message: M.emailInvalid })),
  role: staffRoleSchema,
});

export const staffUpdateProfileSchema = staffProfileSchema.extend({ id });

export const staffUpdateRoleSchema = z.object({ id, role: staffRoleSchema });

export const staffIdSchema = z.object({ id });

export type StaffProfileValues = z.infer<typeof staffProfileSchema>;
export type StaffInsertValues = z.infer<typeof staffInsertSchema>;
/** What the form holds before the schema has normalised it. */
export type StaffFormValues = z.input<typeof staffInsertSchema>;
export type StaffRoleValues = z.input<typeof staffUpdateRoleSchema>;
