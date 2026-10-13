import { z } from "zod";

import { CERTIFICATE_BODY_MAX } from "@/modules/documents/constants";
import {
  CERTIFICATE_TEMPLATE_MESSAGES as M,
  CERTIFICATE_TEMPLATE_TITLE_MAX,
} from "./constants";
import { templateBodyError } from "./variables";

/**
 * The template editor's contract — the procedure's `.input()` and the form's
 * `zodResolver`. No create, no delete in V1 (prompts/29): the three seeded
 * templates are the set.
 */
export const certificateTemplateFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: M.titleRequired })
    .max(CERTIFICATE_TEMPLATE_TITLE_MAX, { message: M.titleTooLong }),
  body: z
    .string()
    .trim()
    .min(1, { message: M.bodyRequired })
    .max(CERTIFICATE_BODY_MAX, { message: M.bodyTooLong })
    // An unknown {{variable}} is refused here, in French, naming it — not
    // discovered by a dentist at generation time.
    .superRefine((body, context) => {
      const error = templateBodyError(body);
      if (error) context.addIssue({ code: "custom", message: error });
    }),
  isActive: z.boolean(),
});

export const certificateTemplateUpdateSchema =
  certificateTemplateFormSchema.extend({
    id: z.string().min(1),
    expectedUpdatedAt: z.date(),
  });

export type CertificateTemplateFormValues = z.output<
  typeof certificateTemplateFormSchema
>;
