import { differenceInYears, parseISO } from "date-fns";

import { clinicNow } from "@/lib/time";
import { MAX_PREGNANCY_WEEKS, MEDICAL_ALERT_LABELS } from "./constants";
import { MedicalAlert, MedicalCondition, PaymentStatus } from "./types";

/**
 * Pure derivations shared by the list and the dossier — two screens that must
 * never disagree about whether a patient owes money or how old they are. Kept
 * out of the components so Vitest can cover them (AGENTS.md §3, «Tests»).
 */

/**
 * «BENALI Karim» — the surname first, upper-cased, as the clinic files and
 * calls it out. One definition, so the table, the dossier header and the
 * breadcrumb can never render the same patient three different ways.
 */
export const formatPatientName = ({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) => `${lastName.toLocaleUpperCase("fr-FR")} ${firstName}`;

/**
 * The patient's payment standing (06-ui.md §4). `remainingCents` is passed in
 * rather than recomputed: the procedure derives it in SQL and components never
 * subtract (08-clinical.md §3).
 */
export const getPaymentStatus = ({
  totalAmountCents,
  amountPaidCents,
  remainingCents,
}: {
  totalAmountCents: number;
  amountPaidCents: number;
  remainingCents: number;
}): PaymentStatus => {
  // An overpayment stays visible as «Avance» — never clamped to zero.
  if (remainingCents < 0) return PaymentStatus.Advance;
  if (totalAmountCents === 0) return PaymentStatus.NoCharges;
  if (remainingCents === 0) return PaymentStatus.Paid;
  if (amountPaidCents === 0) return PaymentStatus.Unpaid;
  return PaymentStatus.Partial;
};

/**
 * Whole years, counted against today on the clinic's wall clock — a UTC server
 * calls it tomorrow for part of every evening (08-clinical.md §4). `null` when
 * the birth date is unknown or unparseable, so the caller shows «—» rather than
 * «NaN ans».
 */
export const getPatientAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;

  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const age = differenceInYears(clinicNow(), parsed);
  return age >= 0 ? age : null;
};

// ── Dossier médical ─────────────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * The term today, in weeks. `pregnancyWeeks` is what was recorded when the
 * dossier was last saved, so a pill reading «12 SA» three months later would
 * be a lie; the recorded term is aged by the whole weeks elapsed since. The
 * form starts from this same figure, so re-saving the dossier for an unrelated
 * edit re-bases it rather than freezing the old term.
 */
export const getCurrentPregnancyWeeks = (
  recordedWeeks: number | null,
  recordedAt: Date,
): number | null => {
  if (recordedWeeks === null) return null;

  // A duration between two instants, so plain epoch arithmetic: no calendar
  // day is involved, and mixing the clinic-zone `clinicNow()` with a
  // system-zone Date in a calendar-day helper lost a day across the offset.
  // A save stamped ahead of the clock never runs the term backwards.
  const elapsed = Math.max(0, clinicNow().getTime() - recordedAt.getTime());
  return recordedWeeks + Math.floor(elapsed / MS_PER_WEEK);
};

/** The history fields the header pills are read from. */
interface MedicalAlertSource {
  onAnticoagulants: boolean;
  onBisphosphonates: boolean;
  needsAntibioticProphylaxis: boolean;
  isPregnant: boolean | null;
  pregnancyWeeks: number | null;
  updatedAt: Date;
}

export interface MedicalAlertPill {
  alert: MedicalAlert;
  /** Visible French text — the pill is never an icon with a tooltip alone. */
  label: string;
}

/**
 * «14 SA», or «terme à vérifier» once the aged term passes a full-term
 * pregnancy — an impossible number would be read as a fact. `null` when no
 * term was recorded. The header pill and the tab both print this.
 */
export const formatPregnancyTerm = (weeks: number | null): string | null => {
  if (weeks === null) return null;
  if (weeks > MAX_PREGNANCY_WEEKS) return "terme à vérifier";
  return `${weeks} SA`;
};

const pregnancyLabel = (weeks: number | null) => {
  const base = MEDICAL_ALERT_LABELS[MedicalAlert.Pregnancy];
  const term = formatPregnancyTerm(weeks);
  return term ? `${base} (${term})` : base;
};

/**
 * One pill per critical flag that holds, in a fixed order so the header does
 * not reshuffle between patients. A dossier never filled in has no pills — the
 * absence of a row is not a clean bill of health, and the Dossier médical tab
 * says so; the header only reports what was recorded.
 */
export const getMedicalAlerts = (
  history: MedicalAlertSource | null,
): MedicalAlertPill[] => {
  if (!history) return [];

  const alerts: MedicalAlertPill[] = [];
  const add = (alert: MedicalAlert) =>
    alerts.push({ alert, label: MEDICAL_ALERT_LABELS[alert] });

  if (history.onAnticoagulants) add(MedicalAlert.Anticoagulants);
  if (history.onBisphosphonates) add(MedicalAlert.Bisphosphonates);
  if (history.needsAntibioticProphylaxis) {
    add(MedicalAlert.AntibioticProphylaxis);
  }
  if (history.isPregnant === true) {
    alerts.push({
      alert: MedicalAlert.Pregnancy,
      label: pregnancyLabel(
        getCurrentPregnancyWeeks(history.pregnancyWeeks, history.updatedAt),
      ),
    });
  }

  return alerts;
};

const MEDICAL_CONDITION_KEYS = new Set<string>(Object.values(MedicalCondition));

/**
 * The column is a jsonb string array, validated on the way in but not by the
 * database. A key that has since left the list is skipped rather than rendered
 * as a raw English key or crashing the label lookup.
 */
export const isMedicalCondition = (key: string): key is MedicalCondition =>
  MEDICAL_CONDITION_KEYS.has(key);
