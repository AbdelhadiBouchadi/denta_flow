import { format } from "date-fns";
import { z } from "zod";

import { clinicNow } from "@/lib/time";
import { BloodType, MedicalCondition, SmokingStatus } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message below is rendered verbatim to a user — review
 * them as French copy, not as debug text (06-ui.md §10).
 *
 * Optional text fields normalise "" to `null` on the way in: a nullable column
 * means "not yet known", never an empty string (01-database.md §3).
 */

const PHONE_PATTERN = /^(?:\+212|0)[5-7]\d{8}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = z.email();

/** "0612345678" and "+212612345678" both store as "+212612345678". */
const toE164 = (value: string) =>
  value.startsWith("0") ? `+212${value.slice(1)}` : value;

/** Trimmed text, with "" — what an untouched input submits — read as `null`. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `Le ${label} est obligatoire` })
    .max(80, { message: `Le ${label} est trop long` });

const phone = z
  .string()
  .trim()
  .min(1, { message: "Le téléphone est obligatoire" })
  .regex(PHONE_PATTERN, {
    message: "Numéro de téléphone marocain invalide (ex. 06 12 34 56 78)",
  })
  .transform(toE164);

const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || PHONE_PATTERN.test(value), {
    message: "Numéro de téléphone marocain invalide (ex. 06 12 34 56 78)",
  })
  .transform((value) => (value === null ? null : toE164(value)));

const optionalEmail = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || EMAIL.safeParse(value).success, {
    message: "Adresse e-mail invalide",
  });

/**
 * A `date` column in "yyyy-MM-dd" form. "Today" is read on the clinic's wall
 * clock, never the server's — a UTC server calls it tomorrow for part of every
 * evening (08-clinical.md §4).
 */
const optionalBirthDate = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine(
    (value) =>
      value === null ||
      (ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))),
    { message: "Date de naissance invalide" },
  )
  .refine((value) => value === null || value <= format(clinicNow(), "yyyy-MM-dd"), {
    message: "La date de naissance ne peut pas être dans le futur",
  });

/** Mirrors the `gender` pgEnum. Values are English, the copy lives in constants.ts. */
export const GENDER_VALUES = ["male", "female"] as const;

export const patientInsertSchema = z.object({
  firstName: requiredName("prénom"),
  lastName: requiredName("nom"),
  phone,
  secondaryPhone: optionalPhone,
  email: optionalEmail,
  birthDate: optionalBirthDate,
  gender: z.enum(GENDER_VALUES, { message: "Sexe invalide" }).nullish(),
  address: optionalText(200, "L’adresse est trop longue"),
  city: optionalText(80, "La ville est trop longue"),
  cin: optionalText(20, "Le numéro de CIN est trop long"),
  profession: optionalText(80, "La profession est trop longue"),
  insurerId: optionalText(50, "Assurance invalide"),
  insuranceNumber: optionalText(50, "Le numéro d’assuré est trop long"),
  allergies: optionalText(500, "Le texte des allergies est trop long"),
  medicalNotes: optionalText(2000, "Les notes médicales sont trop longues"),
  tagIds: z.array(z.string()).default([]),
});

/** Update = insert + id. The fields are never redeclared (05-slice.md §1). */
export const patientUpdateSchema = patientInsertSchema.extend({
  id: z.string().min(1, { message: "Identifiant requis" }),
});

/** What the form holds while it is being typed — "" before it becomes `null`. */
export type PatientFormValues = z.input<typeof patientInsertSchema>;
/** What the procedure receives once the schema has normalised it. */
export type PatientInsertValues = z.output<typeof patientInsertSchema>;

// ── Dossier médical ─────────────────────────────────────────────────────────

/** The canonical order the checkbox grid and the read view list them in. */
const MEDICAL_CONDITION_ORDER = Object.values(MedicalCondition);

const PREGNANCY_WEEKS_MESSAGE =
  "Le terme doit être un nombre de semaines entre 1 et 42";

/**
 * The fields of the dossier médical, as the form edits them. There is no
 * insert/update pair: a patient has at most one history, so the one write is
 * an upsert keyed on the patient (see `medicalHistoryUpsertSchema`).
 */
export const medicalHistorySchema = z.object({
  // Deduplicated and put back in canonical order, so the stored array does not
  // depend on the order the boxes were ticked in.
  conditions: z
    .array(z.enum(MedicalCondition, { message: "Antécédent médical inconnu" }))
    .transform((keys) =>
      MEDICAL_CONDITION_ORDER.filter((key) => keys.includes(key)),
    ),
  onAnticoagulants: z.boolean(),
  onBisphosphonates: z.boolean(),
  needsAntibioticProphylaxis: z.boolean(),
  // `null` is «non renseigné» — not the same answer as «non».
  isPregnant: z.boolean().nullable(),
  pregnancyWeeks: z
    .number({ message: PREGNANCY_WEEKS_MESSAGE })
    .int({ message: PREGNANCY_WEEKS_MESSAGE })
    .min(1, { message: PREGNANCY_WEEKS_MESSAGE })
    .max(42, { message: PREGNANCY_WEEKS_MESSAGE })
    .nullable(),
  isBreastfeeding: z.boolean().nullable(),
  currentMedications: optionalText(
    1000,
    "La liste des traitements est trop longue",
  ),
  surgicalHistory: optionalText(
    2000,
    "Les antécédents chirurgicaux sont trop longs",
  ),
  anesthesiaReactions: optionalText(
    500,
    "Le texte des réactions à l’anesthésie est trop long",
  ),
  smoking: z.enum(SmokingStatus, { message: "Statut tabagique invalide" }),
  bruxism: z.boolean(),
  bloodType: z
    .enum(BloodType, { message: "Groupe sanguin invalide" })
    .nullable(),
  primaryDoctorName: optionalText(
    120,
    "Le nom du médecin traitant est trop long",
  ),
  primaryDoctorPhone: optionalPhone,
  emergencyContactName: optionalText(
    120,
    "Le nom du contact d’urgence est trop long",
  ),
  emergencyContactPhone: optionalPhone,
  emergencyContactRelation: optionalText(40, "Le lien de parenté est trop long"),
});

/** The procedure input: the same fields, plus the patient they belong to. */
export const medicalHistoryUpsertSchema = medicalHistorySchema.extend({
  patientId: z.string().min(1, { message: "Identifiant requis" }),
});

export type MedicalHistoryFormValues = z.input<typeof medicalHistorySchema>;
export type MedicalHistoryValues = z.output<typeof medicalHistorySchema>;
