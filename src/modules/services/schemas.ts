import { z } from "zod";

import {
  NGAP_IMPORT_MAX_CODES,
  NGAP_SEARCH_MAX_LIMIT,
  SERVICE_CODE_MAX,
  SERVICE_DURATION_MAX,
  SERVICE_DURATION_MIN,
  SERVICE_LABEL_MAX,
  SERVICE_PRICE_MAX_CENTS,
  SERVICE_VALIDATION_MESSAGES as M,
} from "./constants";
import { ServiceCategory } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * Isomorphic on purpose — nothing here imports ngap.ts, so the form can use it
 * without the nomenclature reaching the browser bundle.
 */

const id = z.string().min(1);

export const serviceFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: M.labelRequired })
    .max(SERVICE_LABEL_MAX, { message: M.labelTooLong }),
  category: z.enum(ServiceCategory, { message: M.categoryInvalid }),
  // Integer centimes (AGENTS.md §6). An emptied MoneyInput arrives as NaN.
  defaultPriceCents: z
    .number({ message: M.priceRequired })
    .int({ message: M.priceInvalid })
    .min(0, { message: M.priceInvalid })
    .max(SERVICE_PRICE_MAX_CENTS, { message: M.priceTooHigh }),
  durationMinutes: z
    .number({ message: M.durationInvalid })
    .int({ message: M.durationInvalid })
    .min(SERVICE_DURATION_MIN, { message: M.durationInvalid })
    .max(SERVICE_DURATION_MAX, { message: M.durationInvalid }),
  // Free text, no format check: an NGAP code or the clinic's own. Blank ⇒ null.
  nomenclatureCode: z
    .string()
    .trim()
    .max(SERVICE_CODE_MAX, { message: M.codeTooLong })
    .nullish()
    .transform((value) => (value ? value : null)),
});

export const serviceUpdateSchema = serviceFormSchema.extend({ id });

export const serviceIdSchema = z.object({ id });

export const ngapSearchSchema = z.object({
  query: z.string().trim().max(100).nullish(),
  chapter: z.string().trim().max(100).nullish(),
  limit: z.number().int().min(1).max(NGAP_SEARCH_MAX_LIMIT).default(NGAP_SEARCH_MAX_LIMIT),
});

/**
 * Deduplicated on the way in. That every code exists in the dataset is checked
 * by the procedure, which is the only side allowed to read the nomenclature.
 */
export const ngapImportSchema = z.object({
  codes: z
    .array(z.string().trim().min(1))
    .min(1, { message: M.importEmpty })
    .max(NGAP_IMPORT_MAX_CODES, { message: M.importTooMany })
    .transform((codes) => [...new Set(codes)]),
});

export type ServiceValues = z.output<typeof serviceFormSchema>;
/** What the form holds before the schema has normalised it. */
export type ServiceFormValues = z.input<typeof serviceFormSchema>;
