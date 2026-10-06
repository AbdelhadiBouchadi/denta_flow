import { z } from "zod";

import { INSURER_VALIDATION_MESSAGES as M } from "./constants";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 */

const id = z.string().min(1);

export const insurerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: M.nameRequired })
    .max(80, { message: M.nameTooLong }),
});

export const insurerUpdateSchema = insurerFormSchema.extend({ id });

export const insurerIdSchema = z.object({ id });

export type InsurerValues = z.infer<typeof insurerFormSchema>;
export type InsurerFormValues = z.input<typeof insurerFormSchema>;
