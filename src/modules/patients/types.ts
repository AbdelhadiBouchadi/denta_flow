import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Patient` is a bug
 * (AGENTS.md §1 rule 6).
 */
export type PatientGetOne = inferRouterOutputs<AppRouter>["patients"]["getOne"];

/** The item array, not the envelope — columns want `PatientGetMany[number]`. */
export type PatientGetMany =
  inferRouterOutputs<AppRouter>["patients"]["getMany"]["items"];

export type PatientListItem = PatientGetMany[number];

/** A tag as it arrives on a patient row, aggregated in SQL. */
export type PatientTagSummary = PatientListItem["tags"][number];

/** `null` ⇒ the dossier médical has never been filled in. */
export type PatientMedicalHistory = PatientGetOne["medicalHistory"];

/** Mirrors the `gender` pgEnum, kept in lockstep. */
export enum Gender {
  Male = "male",
  Female = "female",
}

/**
 * The payment family of 06-ui.md §4 — derived from the three money figures,
 * never stored and never read from a column.
 */
export enum PaymentStatus {
  Paid = "paid",
  Partial = "partial",
  Unpaid = "unpaid",
  /** The patient has paid more than they owe (08-clinical.md §3). */
  Advance = "advance",
  /** Nothing billed yet — a brand new dossier. */
  NoCharges = "no_charges",
}

/** The dossier's tabs. English keys, they are URL values (AGENTS.md §5). */
export enum PatientTab {
  Informations = "informations",
  MedicalHistory = "medical_history",
  Appointments = "appointments",
  Treatments = "treatments",
  Payments = "payments",
  Documents = "documents",
}

/**
 * The `conditions` keys. Not a pgEnum — the column is a jsonb array — so this
 * list, through the Zod enum built from it, is the only thing that validates a
 * key before it is stored.
 */
export enum MedicalCondition {
  Diabetes = "diabetes",
  Hypertension = "hypertension",
  HeartDisease = "heart_disease",
  BleedingDisorder = "bleeding_disorder",
  Asthma = "asthma",
  Epilepsy = "epilepsy",
  Hepatitis = "hepatitis",
  Hiv = "hiv",
  KidneyDisease = "kidney_disease",
  Thyroid = "thyroid",
  Osteoporosis = "osteoporosis",
}

/** Mirrors the `smoking_status` pgEnum, kept in lockstep. */
export enum SmokingStatus {
  None = "none",
  Occasional = "occasional",
  Regular = "regular",
}

/** Mirrors the `blood_type` pgEnum, kept in lockstep. */
export enum BloodType {
  APos = "a_pos",
  ANeg = "a_neg",
  BPos = "b_pos",
  BNeg = "b_neg",
  AbPos = "ab_pos",
  AbNeg = "ab_neg",
  OPos = "o_pos",
  ONeg = "o_neg",
}

/**
 * The facts that change what the dentist may safely do before any acte — each
 * one is a danger pill on the dossier header when it holds.
 */
export enum MedicalAlert {
  Anticoagulants = "anticoagulants",
  Bisphosphonates = "bisphosphonates",
  AntibioticProphylaxis = "antibiotic_prophylaxis",
  Pregnancy = "pregnancy",
}
