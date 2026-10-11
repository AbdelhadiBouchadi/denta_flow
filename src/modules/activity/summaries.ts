import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { formatDH } from "@/lib/format";
import { toClinicTime } from "@/lib/time";
import { APPOINTMENT_STATUS_LABELS } from "@/modules/appointments/constants";
import type { AppointmentStatus } from "@/modules/appointments/types";
import { DOCUMENT_TYPE_LABELS } from "@/modules/documents/constants";
import {
  DocumentType,
  type GeneratedDocumentType,
} from "@/modules/documents/types";
import { TREATMENT_STATUS_LABELS } from "@/modules/treatments/constants";
import type { TreatmentStatus } from "@/modules/treatments/types";

/**
 * Every sentence «Activité du jour» prints, and the only place one is built.
 * The writers (each slice's procedures, and the seed) call these and hand
 * the result to `logActivity`; the screen renders `summary` verbatim.
 *
 * The rules (prompts/27, decision 4), enforced by the SIGNATURES below and
 * covered by summaries.test.ts:
 * - a sentence names the patient and the action — never allergy, medical
 *   notes or any free text a staff member typed;
 * - only `PAYMENT_SUMMARIES` receives an amount. The other builders take no
 *   number at all, so an amount cannot reach an acte or a document line by
 *   accident — and payment rows are admin-only on the read side.
 *
 * `patient` is the display name the caller formatted with
 * `formatPatientName` («BENALI Amine»).
 */

// ── Grammar ─────────────────────────────────────────────────────────────────

/** A vowel (accented or not) or a «y»: «de» elides before it. Never «h». */
const ELIDES = /^[aeiouyàâäéèêëîïôöùûüÿæœ]/i;

/** «de BENALI Amine», «d’EL AMRANI Karim». */
export const ofPatient = (patient: string) =>
  ELIDES.test(patient) ? `d’${patient}` : `de ${patient}`;

/** « (dent 11) », « (dents 11, 12) », or nothing for an acte without teeth. */
export const teethSuffix = (teeth: readonly string[]) => {
  if (teeth.length === 0) return "";
  const noun = teeth.length > 1 ? "dents" : "dent";
  return ` (${noun} ${teeth.join(", ")})`;
};

/** «« Planifié » à « Annulé »» — the same quoting as the transition errors. */
const fromTo = (from: string, to: string) => `de « ${from} » à « ${to} »`;

/** «jeudi 8 octobre à 10 h 30», read on the clinic's wall clock. */
export const formatSlot = (instant: Date) =>
  format(toClinicTime(instant), "EEEE d MMMM 'à' HH' h 'mm", { locale: fr });

// ── Appointments ────────────────────────────────────────────────────────────

export const APPOINTMENT_SUMMARIES = {
  created: (patient: string, startsAt: Date) =>
    `Rendez-vous ${ofPatient(patient)} pris pour le ${formatSlot(startsAt)}.`,
  /**
   * A new slot: «déplacé du … au …». The same slot means only the
   * practitioner changed.
   */
  rescheduled: (patient: string, from: Date, to: Date) =>
    from.getTime() === to.getTime()
      ? `Rendez-vous ${ofPatient(patient)} du ${formatSlot(to)} confié à un autre praticien.`
      : `Rendez-vous ${ofPatient(patient)} déplacé du ${formatSlot(from)} au ${formatSlot(to)}.`,
  /**
   * Saved without a new start or practitioner (reason, notes, type,
   * duration). Never quotes what changed: reason and notes are free text
   * that may be medical (prompts/27, decision 4).
   */
  updated: (patient: string, startsAt: Date) =>
    `Rendez-vous ${ofPatient(patient)} du ${formatSlot(startsAt)} modifié.`,
  statusChanged: (
    patient: string,
    from: AppointmentStatus,
    to: AppointmentStatus,
  ) =>
    `Rendez-vous ${ofPatient(patient)} passé ${fromTo(
      APPOINTMENT_STATUS_LABELS[from],
      APPOINTMENT_STATUS_LABELS[to],
    )}.`,
  removed: (patient: string, startsAt: Date) =>
    `Rendez-vous ${ofPatient(patient)} du ${formatSlot(startsAt)} supprimé.`,
} as const;

// ── Actes ───────────────────────────────────────────────────────────────────
// The acte's label is the catalogue snapshot («Détartrage»), never its notes.

export const TREATMENT_SUMMARIES = {
  created: (patient: string, label: string, teeth: readonly string[]) =>
    `Acte « ${label} »${teethSuffix(teeth)} ajouté pour ${patient}.`,
  updated: (patient: string, label: string) =>
    `Acte « ${label} » ${ofPatient(patient)} modifié.`,
  statusChanged: (
    patient: string,
    label: string,
    from: TreatmentStatus,
    to: TreatmentStatus,
  ) =>
    `Acte « ${label} » ${ofPatient(patient)} passé ${fromTo(
      TREATMENT_STATUS_LABELS[from],
      TREATMENT_STATUS_LABELS[to],
    )}.`,
  removed: (patient: string, label: string, teeth: readonly string[]) =>
    `Acte « ${label} »${teethSuffix(teeth)} ${ofPatient(patient)} supprimé.`,
} as const;

// ── Payments — the ONLY builders that take an amount ────────────────────────

export const PAYMENT_SUMMARIES = {
  created: (patient: string, amountCents: number) =>
    `Paiement de ${formatDH(amountCents)} enregistré pour ${patient}.`,
  updated: (patient: string, beforeCents: number, afterCents: number) =>
    beforeCents === afterCents
      ? `Paiement ${ofPatient(patient)} modifié (${formatDH(afterCents)}).`
      : `Paiement ${ofPatient(patient)} modifié : ${formatDH(beforeCents)} → ${formatDH(afterCents)}.`,
  /** A deleted payment leaves a trail of what it was. */
  removed: (patient: string, amountCents: number) =>
    `Paiement ${ofPatient(patient)} supprimé (${formatDH(amountCents)}).`,
} as const;

// ── Odontogramme ────────────────────────────────────────────────────────────
// The chart's content is never described: it is clinical and opaque.

export const ODONTOGRAM_SUMMARIES = {
  /** Every save, the first included (prompts/28, decision 5). */
  updated: (patient: string) => `Odontogramme mis à jour — ${patient}.`,
  reset: (patient: string) =>
    `Odontogramme réinitialisé (situation initiale effacée) — ${patient}.`,
} as const;

// ── Documents ───────────────────────────────────────────────────────────────
// Type, number and patient. `number` may be a token the SQL replaces with the
// number the insert assigned (documents/server/procedures.ts).

const ISSUED: Record<GeneratedDocumentType, string> = {
  [DocumentType.Invoice]: "générée",
  [DocumentType.Quote]: "généré",
};

const REMOVED: Record<GeneratedDocumentType, string> = {
  [DocumentType.Invoice]: "supprimée",
  [DocumentType.Quote]: "supprimé",
};

export const DOCUMENT_SUMMARIES = {
  generated: (type: GeneratedDocumentType, number: string, patient: string) =>
    `${DOCUMENT_TYPE_LABELS[type]} ${number} ${ISSUED[type]} pour ${patient}.`,
  removed: (type: GeneratedDocumentType, number: string, patient: string) =>
    `${DOCUMENT_TYPE_LABELS[type]} ${number} ${ofPatient(patient)} ${REMOVED[type]} (numéro non réattribué).`,
} as const;
