import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import {
  MEDICATION_FIELD_MAX,
  MEDICATION_VALIDATION_MESSAGES as M,
  PACK_FIELD_MAX,
  PACK_MAX_ITEMS,
  PACK_VALIDATION_MESSAGES as PM,
} from "./constants";
import { normalizeMedicationText } from "./normalize";
import {
  MEDICATION_STATUS_FILTER_VALUES,
  MedicationStatusFilter,
} from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 * Text is normalised here (normalize.ts), so the form, the procedure and the
 * de-duplication key all see the same string.
 */

const id = z.string().min(1);

/** Trimmed, spaces collapsed; blank ⇒ null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, { message })
    .nullish()
    .transform((value) => {
      const normalized = value ? normalizeMedicationText(value) : "";
      return normalized ? normalized : null;
    });

const requiredText = (max: number, required: string, tooLong: string) =>
  z
    .string()
    .transform(normalizeMedicationText)
    .pipe(z.string().min(1, { message: required }).max(max, { message: tooLong }));

// ── Medications ─────────────────────────────────────────────────────────────

export const medicationFormSchema = z.object({
  name: requiredText(MEDICATION_FIELD_MAX.name, M.nameRequired, M.nameTooLong),
  form: requiredText(MEDICATION_FIELD_MAX.form, M.formRequired, M.formTooLong),
  strength: optionalText(MEDICATION_FIELD_MAX.strength, M.strengthTooLong),
  defaultPosology: optionalText(
    MEDICATION_FIELD_MAX.posology,
    M.posologyTooLong,
  ),
  defaultDuration: optionalText(
    MEDICATION_FIELD_MAX.duration,
    M.durationTooLong,
  ),
});

/**
 * `expectedUpdatedAt` is the row's `updatedAt` as the editor loaded it: a
 * save over someone else's change is refused (CONFLICT), not silently lost.
 */
export const medicationUpdateSchema = medicationFormSchema.extend({
  id,
  expectedUpdatedAt: z.date(),
});

export const medicationSetActiveSchema = z.object({ id, isActive: z.boolean() });

export const medicationGetManySchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().nullish(),
  status: z
    .enum(MEDICATION_STATUS_FILTER_VALUES)
    .default(MedicationStatusFilter.All),
});

// ── Packs ───────────────────────────────────────────────────────────────────

export const packItemSchema = z.object({
  medicationId: z.string().min(1, { message: PM.medicationRequired }),
  posology: requiredText(
    MEDICATION_FIELD_MAX.posology,
    PM.posologyRequired,
    PM.posologyTooLong,
  ),
  duration: optionalText(MEDICATION_FIELD_MAX.duration, PM.durationTooLong),
  remark: optionalText(PACK_FIELD_MAX.remark, PM.remarkTooLong),
});

export const packFormSchema = z.object({
  name: requiredText(PACK_FIELD_MAX.name, PM.nameRequired, PM.nameTooLong),
  notes: optionalText(PACK_FIELD_MAX.notes, PM.notesTooLong),
  items: z
    .array(packItemSchema)
    .min(1, { message: PM.itemsEmpty })
    .max(PACK_MAX_ITEMS, { message: PM.itemsTooMany }),
});

export const packUpdateSchema = packFormSchema.extend({ id });

export const packIdSchema = z.object({ id });

export type MedicationFormInput = z.input<typeof medicationFormSchema>;
export type MedicationFormValues = z.output<typeof medicationFormSchema>;
export type PackFormInput = z.input<typeof packFormSchema>;
export type PackFormValues = z.output<typeof packFormSchema>;
