import {
  CalendarClockIcon,
  CreditCardIcon,
  FileTextIcon,
  HeartPulseIcon,
  StethoscopeIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";

import type { StatusTone } from "@/components/shared/status-badge";
import {
  BloodType,
  Gender,
  MedicalAlert,
  MedicalCondition,
  PatientTab,
  PaymentStatus,
  SmokingStatus,
} from "./types";

/**
 * The only place French enum copy exists for this slice. Never inline one of
 * these labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 */

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Male]: "Homme",
  [Gender.Female]: "Femme",
};

export const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(
  ([value, label]) => ({ value: value as Gender, label }),
);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.Paid]: "Payé",
  [PaymentStatus.Partial]: "Reste à payer",
  [PaymentStatus.Unpaid]: "Impayé",
  [PaymentStatus.Advance]: "Avance",
  [PaymentStatus.NoCharges]: "Aucun acte",
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  [PaymentStatus.Paid]: "success",
  [PaymentStatus.Partial]: "warning",
  [PaymentStatus.Unpaid]: "danger",
  [PaymentStatus.Advance]: "info",
  [PaymentStatus.NoCharges]: "neutral",
};

export interface PatientTabDefinition {
  value: PatientTab;
  label: string;
  icon: LucideIcon;
}

/** The dossier médical sits right after Informations (prompt 10b). */
export const PATIENT_TABS: readonly PatientTabDefinition[] = [
  { value: PatientTab.Informations, label: "Informations", icon: UserIcon },
  {
    value: PatientTab.MedicalHistory,
    label: "Dossier médical",
    icon: HeartPulseIcon,
  },
  {
    value: PatientTab.Appointments,
    label: "Rendez-vous",
    icon: CalendarClockIcon,
  },
  { value: PatientTab.Treatments, label: "Actes", icon: StethoscopeIcon },
  { value: PatientTab.Payments, label: "Paiements", icon: CreditCardIcon },
  { value: PatientTab.Documents, label: "Documents", icon: FileTextIcon },
] as const;

/** The literal union the nuqs parser accepts, derived from the tab list. */
export const PATIENT_TAB_VALUES = [
  PatientTab.Informations,
  PatientTab.MedicalHistory,
  PatientTab.Appointments,
  PatientTab.Treatments,
  PatientTab.Payments,
  PatientTab.Documents,
] as const;

export const DEFAULT_PATIENT_TAB = PatientTab.Informations;

/** Shown wherever a patient has no insurer (06-ui.md §4, «Couverture»). */
export const NO_INSURER_LABEL = "Sans couverture";

/** The dash that stands in for a field the clinic has not recorded yet. */
export const EMPTY_FIELD = "—";

/** How many tag pills a table cell shows before collapsing into «+N». */
export const MAX_VISIBLE_TAGS = 2;

// ── Dossier médical ─────────────────────────────────────────────────────────

export const MEDICAL_CONDITION_LABELS: Record<MedicalCondition, string> = {
  [MedicalCondition.Diabetes]: "Diabète",
  [MedicalCondition.Hypertension]: "Hypertension artérielle",
  [MedicalCondition.HeartDisease]: "Maladie cardiaque",
  [MedicalCondition.BleedingDisorder]: "Trouble de la coagulation",
  [MedicalCondition.Asthma]: "Asthme",
  [MedicalCondition.Epilepsy]: "Épilepsie",
  [MedicalCondition.Hepatitis]: "Hépatite",
  [MedicalCondition.Hiv]: "VIH",
  [MedicalCondition.KidneyDisease]: "Maladie rénale",
  [MedicalCondition.Thyroid]: "Trouble thyroïdien",
  [MedicalCondition.Osteoporosis]: "Ostéoporose",
};

export const MEDICAL_CONDITION_OPTIONS = Object.entries(
  MEDICAL_CONDITION_LABELS,
).map(([value, label]) => ({ value: value as MedicalCondition, label }));

export const SMOKING_STATUS_LABELS: Record<SmokingStatus, string> = {
  [SmokingStatus.None]: "Non-fumeur",
  [SmokingStatus.Occasional]: "Fumeur occasionnel",
  [SmokingStatus.Regular]: "Fumeur régulier",
};

export const SMOKING_STATUS_OPTIONS = Object.entries(SMOKING_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as SmokingStatus, label }),
);

/** A true minus sign, not a hyphen: «O−» is how the lab report prints it. */
export const BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  [BloodType.APos]: "A+",
  [BloodType.ANeg]: "A−",
  [BloodType.BPos]: "B+",
  [BloodType.BNeg]: "B−",
  [BloodType.AbPos]: "AB+",
  [BloodType.AbNeg]: "AB−",
  [BloodType.OPos]: "O+",
  [BloodType.ONeg]: "O−",
};

export const BLOOD_TYPE_OPTIONS = Object.entries(BLOOD_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as BloodType, label }),
);

/**
 * The header's danger pills. «Enceinte» gains its term in weeks («SA»,
 * semaines d’aménorrhée) where one is known — see `getMedicalAlerts`.
 */
export const MEDICAL_ALERT_LABELS: Record<MedicalAlert, string> = {
  [MedicalAlert.Anticoagulants]: "Anticoagulants",
  [MedicalAlert.Bisphosphonates]: "Bisphosphonates",
  [MedicalAlert.AntibioticProphylaxis]: "Antibioprophylaxie",
  [MedicalAlert.Pregnancy]: "Enceinte",
};

/** Why each pill matters — the pill's tooltip and its screen-reader text. */
export const MEDICAL_ALERT_DESCRIPTIONS: Record<MedicalAlert, string> = {
  [MedicalAlert.Anticoagulants]:
    "Sous anticoagulants : risque hémorragique, vérifier l’INR avant tout acte sanglant.",
  [MedicalAlert.Bisphosphonates]:
    "Sous bisphosphonates : risque d’ostéonécrose des mâchoires après extraction ou chirurgie.",
  [MedicalAlert.AntibioticProphylaxis]:
    "Antibioprophylaxie requise avant tout acte à risque infectieux.",
  [MedicalAlert.Pregnancy]:
    "Patiente enceinte : limiter les radiographies et vérifier chaque prescription.",
};

/**
 * A recorded term older than a full-term pregnancy can no longer be trusted:
 * the pill asks for it to be checked rather than print an impossible number.
 */
export const MAX_PREGNANCY_WEEKS = 42;

/** The three answers of a nullable boolean. `null` is not «Non». */
export const TRI_STATE_LABELS = {
  yes: "Oui",
  no: "Non",
  unknown: "Non renseigné",
} as const;
