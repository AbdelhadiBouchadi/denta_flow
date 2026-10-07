import type { StatusTone } from "@/components/shared/status-badge";
import { Dentition, TreatmentStatus } from "./types";

/**
 * The only place French copy for this slice exists. Never inline one of these
 * labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 */

// ── Status ──────────────────────────────────────────────────────────────────

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  [TreatmentStatus.Planned]: "Prévu",
  [TreatmentStatus.InProgress]: "En cours",
  [TreatmentStatus.Completed]: "Réalisé",
  [TreatmentStatus.Canceled]: "Annulé",
};

export const TREATMENT_STATUS_TONES: Record<TreatmentStatus, StatusTone> = {
  [TreatmentStatus.Planned]: "neutral",
  [TreatmentStatus.InProgress]: "info",
  [TreatmentStatus.Completed]: "success",
  [TreatmentStatus.Canceled]: "danger",
};

/** The literal union the nuqs parser and the Zod enum accept. */
export const TREATMENT_STATUS_VALUES = [
  TreatmentStatus.Planned,
  TreatmentStatus.InProgress,
  TreatmentStatus.Completed,
  TreatmentStatus.Canceled,
] as const;

export const TREATMENT_STATUS_OPTIONS = TREATMENT_STATUS_VALUES.map(
  (value) => ({ value, label: TREATMENT_STATUS_LABELS[value] }),
);

export const DENTITION_LABELS: Record<Dentition, string> = {
  [Dentition.Adult]: "Adulte",
  [Dentition.Child]: "Enfant",
};

// ── Limits ──────────────────────────────────────────────────────────────────

/** The dossier's «Actes» tab shows at most this many, newest first. */
export const PATIENT_TREATMENTS_LIMIT = 200;

/** A table cell names this many teeth, then «+N» (full list in a tooltip). */
export const MAX_VISIBLE_TEETH = 3;

export const TREATMENT_LABEL_MAX = 200;
export const TREATMENT_NOTES_MAX = 2000;
export const TREATMENT_CODE_MAX = 20;

// ── Validation and server copy ──────────────────────────────────────────────

export const TREATMENT_VALIDATION_MESSAGES = {
  patientRequired: "Choisissez un patient",
  labelRequired: "Saisissez le libellé de l’acte",
  labelTooLong: "Le libellé est trop long",
  codeTooLong: "Le code est trop long",
  toothInvalid: "Dent invalide (numérotation FDI)",
  amountInvalid: "Le montant doit être un nombre positif ou nul",
  statusInvalid: "Statut d’acte invalide",
  dateInvalid: "Choisissez une date valide",
  dateRequired: "Choisissez la date",
  timeRequired: "Choisissez l’heure",
  notesTooLong: "Les notes sont trop longues",
} as const;

export const TREATMENT_SERVER_ERRORS = {
  notFound: "Acte introuvable.",
  patientNotFound: "Patient introuvable.",
  patientArchived:
    "Ce patient est archivé. Réactivez son dossier avant d’y enregistrer un acte.",
  practitionerInvalid:
    "Ce praticien n’existe plus, n’est plus actif ou n’est pas praticien.",
  appointmentMismatch:
    "Ce rendez-vous n’appartient pas à ce patient. Choisissez un de ses rendez-vous.",
  serviceUnavailable:
    "Cet acte du catalogue n’existe plus ou a été désactivé. Choisissez-en un autre.",
  missingReference:
    "Le patient, le praticien, le rendez-vous ou l’acte du catalogue sélectionné n’existe plus. Actualisez la page, puis réessayez.",
  /** Optimistic concurrency — the same family as the appointments' message. */
  treatmentChangedMeanwhile:
    "Cet acte a été modifié entre-temps. Rechargez-le avant de réessayer.",
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const TREATMENT_FIELD_LABELS = {
  patient: "Patient",
  service: "Acte du catalogue",
  label: "Libellé",
  code: "Code NGAP",
  teeth: "Dents",
  amount: "Montant",
  status: "Statut",
  practitioner: "Praticien",
  performedDate: "Date de réalisation",
  performedTime: "Heure",
  appointment: "Rendez-vous lié",
  notes: "Notes",
} as const;

export const TREATMENT_FIELD_PLACEHOLDERS = {
  patient: "Rechercher un patient…",
  service: "Choisir dans le catalogue…",
  label: "ex. Détartrage, composite 2 faces…",
  code: "ex. D701",
  practitioner: "Aucun praticien",
  appointment: "Aucun rendez-vous",
  date: "Choisir une date",
  notes: "Informations utiles pour l’équipe",
} as const;

export const TREATMENT_COPY = {
  pageTitle: "Actes",
  newButton: "Nouvel acte",
  newTitle: "Nouvel acte",
  newDescription:
    "Choisissez l’acte dans le catalogue : libellé, code et tarif sont repris, et restent modifiables.",
  editTitle: "Modifier l’acte",
  editDescription:
    "Le libellé et le montant sont ceux enregistrés pour cet acte ; changer le tarif du catalogue ne les modifie pas.",
  created: "Acte enregistré",
  updated: "Acte mis à jour",
  removed: "Acte supprimé",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",
  cancel: "Annuler",
  edit: "Modifier",
  remove: "Supprimer",
  openDossier: "Voir le dossier",
  actionsLabel: "Actions de l’acte",
  removeTitle: "Supprimer cet acte ?",
  removeDescription:
    "L’acte est effacé définitivement du dossier du patient. Les paiements qui lui étaient affectés sont conservés et restent sur le compte du patient. Pour garder une trace, préférez le statut « Annulé ».",
  searchPlaceholder: "Rechercher un acte, un patient…",
  searchLabel: "Rechercher un acte",
  dossierSearchPlaceholder: "Rechercher par nom d’acte",
  allStatuses: "Tous les statuts",
  allPractitioners: "Tous les praticiens",
  from: "Du",
  to: "Au",
  clearFilters: "Effacer les filtres",
  emptyTitle: "Aucun acte",
  emptyDefault: "Aucun acte pour le moment.",
  emptyFiltered:
    "Aucun acte ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  emptyDossierSearch: "Aucun acte ne correspond à cette recherche.",
  loadingTitle: "Chargement des actes",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des actes n’a pas pu être chargée. Veuillez réessayer.",
  noPractitioner: "Non attribué",
  noTeeth: "—",
  emptyField: "—",
  noServiceFound: "Aucun acte trouvé.",
  inactiveService: "désactivé",
  remainingTooltip:
    "Reste sur les paiements affectés à cet acte uniquement. Le solde réel du patient est celui de son dossier.",
  applySuggestion: "Appliquer",
  clearDate: "Effacer la date",
  truncated: (shown: number, total: number) =>
    `Les ${shown} actes les plus récents sur ${total} sont affichés.`,
} as const;

/**
 * The dossier tab's summary strip. The balance's own label («Reste à payer» /
 * «Avance») comes from `describeBalance` in src/lib/format.ts.
 */
export const TREATMENT_SUMMARY_LABELS = {
  total: "Total à payer",
  paid: "Payé",
  planned: "Prévu",
} as const;

export const TOOTH_SELECT_COPY = {
  groupLabel: "Sélection des dents (numérotation FDI)",
  upper: "Arcade haute",
  lower: "Arcade basse",
  clear: "Effacer",
  selection: "Sélection",
  none: "Aucune dent — acte sans dent (consultation, détartrage, radiographie…)",
} as const;

export const TREATMENT_COLUMN_HEADERS = {
  date: "Date",
  patient: "Patient",
  label: "Acte",
  teeth: "Dents",
  practitioner: "Praticien",
  amount: "Montant",
  status: "Statut",
  remaining: "Reste",
} as const;

/** «3 dents», «1 dent». */
export const teethCountLabel = (count: number) =>
  `${count} ${count > 1 ? "dents" : "dent"}`;

/** «300,00 DH × 3 dents» — the suggested-total hint. */
export const suggestedTotalHint = (unitPrice: string, teethCount: number) =>
  `${unitPrice} × ${teethCountLabel(teethCount)}`;

/** «+2» after the visible teeth. */
export const moreTeethLabel = (hidden: number) => `+${hidden}`;
