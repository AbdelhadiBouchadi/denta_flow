import { z } from "zod";

import { PALETTE_COLORS } from "@/components/shared/color-palette";
import { TAG_ICON_NAMES, TAG_VALIDATION_MESSAGES as M } from "./constants";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 */

const id = z.string().min(1);

export const tagFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: M.labelRequired })
    .max(40, { message: M.labelTooLong }),
  // The palette only — never a free hex (prompts/13-tags-assurances.md).
  color: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(PALETTE_COLORS, { message: M.colorInvalid })),
  // A key of the curated map, or nothing. "" from the form means nothing.
  icon: z
    .string()
    .nullish()
    .transform((value) => value || null)
    .pipe(z.enum(TAG_ICON_NAMES, { message: M.iconInvalid }).nullable()),
});

export const tagUpdateSchema = tagFormSchema.extend({ id });

export const tagIdSchema = z.object({ id });

export type TagValues = z.infer<typeof tagFormSchema>;
/** What the form holds before the schema has normalised it. */
export type TagFormValues = z.input<typeof tagFormSchema>;
