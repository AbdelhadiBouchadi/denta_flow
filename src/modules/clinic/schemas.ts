import { z } from "zod";

import { isClinicBlobUrl } from "@/lib/assets";
import { CLINIC_ASSET_ERRORS, CLINIC_VALIDATION_MESSAGES } from "./constants";
import { ClinicAssetKind } from "./types";

/**
 * The fields `clinic.uploadAsset` reads out of its FormData. The procedure's
 * `.input()` is `z.instanceof(FormData)` — FormData cannot be described field
 * by field at the wire — so this schema parses the entries inside it.
 *
 * Size, MIME and magic-byte checks are not here: they need the bytes, and
 * each maps to its own error code.
 */
export const clinicAssetUploadSchema = z.object({
  kind: z.enum(ClinicAssetKind, { message: CLINIC_ASSET_ERRORS.invalidKind }),
  file: z.instanceof(File, { message: CLINIC_ASSET_ERRORS.missingFile }),
});

const EMAIL = z.email();

/** Trimmed text, with "" — what an untouched input submits — read as `null`. */
const optionalText = (max?: { length: number; message: string }) => {
  const base = z.string().trim();
  return (max ? base.max(max.length, { message: max.message }) : base)
    .nullish()
    .transform((value) => (value ? value : null));
};

/**
 * ICE, Patente, IF, CNSS, INPE: "not empty" is the only rule. Their formats
 * vary by city and by year of registration, and a wrong rejection would stop
 * a clinic from printing its own invoices.
 */
const identifier = optionalText();

const optionalEmail = optionalText().refine(
  (value) => value === null || EMAIL.safeParse(value).success,
  { message: CLINIC_VALIDATION_MESSAGES.invalidEmail },
);

/**
 * A saved asset: a string is a new URL, `null` removes it, `undefined` leaves
 * the stored one alone. A string must point into this project's blob store —
 * the column is rendered as an <img> on every page and every printed document.
 */
const assetUrl = z
  .string()
  .refine(isClinicBlobUrl, {
    message: CLINIC_VALIDATION_MESSAGES.foreignAsset,
  })
  .nullish();

/** The text fields — one schema for the form's `zodResolver` and the procedure. */
export const clinicSettingsFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: CLINIC_VALIDATION_MESSAGES.nameRequired })
    .max(120, { message: CLINIC_VALIDATION_MESSAGES.nameTooLong }),
  address: optionalText({
    length: 200,
    message: CLINIC_VALIDATION_MESSAGES.addressTooLong,
  }),
  city: optionalText({
    length: 80,
    message: CLINIC_VALIDATION_MESSAGES.cityTooLong,
  }),
  phone: optionalText({
    length: 30,
    message: CLINIC_VALIDATION_MESSAGES.phoneTooLong,
  }),
  email: optionalEmail,
  ice: identifier,
  patente: identifier,
  fiscalId: identifier,
  cnssNumber: identifier,
  inpe: identifier,
});

/** `clinic.update`'s input: the text fields plus the two staged assets. */
export const clinicSettingsUpdateSchema = clinicSettingsFormSchema.extend({
  logoUrl: assetUrl,
  letterheadUrl: assetUrl,
});

/** What the form holds while it is being typed — "" before it becomes `null`. */
export type ClinicSettingsFormValues = z.input<typeof clinicSettingsFormSchema>;
/** What the procedure receives once the schema has normalised it. */
export type ClinicSettingsValues = z.output<typeof clinicSettingsFormSchema>;
