import { PaymentMethod } from "./types";

/**
 * The only place French copy for this slice exists. Never inline one of these
 * labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 */

// ── Methods ─────────────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: "Espèces",
  [PaymentMethod.Check]: "Chèque",
  [PaymentMethod.Card]: "Carte bancaire",
  [PaymentMethod.Transfer]: "Virement",
  [PaymentMethod.Insurance]: "Assurance",
};

/** The literal union the nuqs parser and the Zod enum accept. */
export const PAYMENT_METHOD_VALUES = [
  PaymentMethod.Cash,
  PaymentMethod.Check,
  PaymentMethod.Card,
  PaymentMethod.Transfer,
  PaymentMethod.Insurance,
] as const;

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_VALUES.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

// ── Limits ──────────────────────────────────────────────────────────────────

/** The dossier's «Paiements» tab shows at most this many, newest first. */
export const PATIENT_PAYMENTS_LIMIT = 200;

export const PAYMENT_REFERENCE_MAX = 100;
export const PAYMENT_NOTES_MAX = 2000;

// ── Validation and server copy ──────────────────────────────────────────────

export const PAYMENT_VALIDATION_MESSAGES = {
  patientRequired: "Choisissez un patient",
  amountInvalid: "Le montant doit être un nombre entier de centimes",
  amountPositive: "Le montant doit être supérieur à zéro",
  methodInvalid: "Mode de paiement invalide",
  dateInvalid: "Choisissez une date valide",
  timeRequired: "Choisissez l’heure",
  inFuture: "La date du paiement ne peut pas être dans le futur",
  insurerRequired: "Choisissez l’assurance qui rembourse",
  insurerForbidden:
    "Une assurance ne s’indique que pour un paiement « Assurance »",
  referenceTooLong: "La référence est trop longue",
  notesTooLong: "Les notes sont trop longues",
} as const;

export const PAYMENT_SERVER_ERRORS = {
  notFound: "Paiement introuvable.",
  patientNotFound: "Patient introuvable.",
  treatmentMismatch:
    "Cet acte n’appartient pas à ce patient. Choisissez un de ses actes.",
  insurerUnavailable:
    "Cette assurance n’existe plus ou a été désactivée. Choisissez-en une autre.",
  missingReference:
    "Le patient, l’acte ou l’assurance sélectionné n’existe plus. Actualisez la page, puis réessayez.",
  patientImmutable:
    "Le patient d’un paiement ne peut pas être changé. Supprimez ce paiement, puis ressaisissez-le sur le bon patient.",
  editForbidden:
    "Seul l’administrateur, ou la personne qui l’a saisi le jour même, peut modifier ce paiement.",
  /** Optimistic concurrency — the same family as the actes' message. */
  changedMeanwhile:
    "Ce paiement a été modifié entre-temps. Rechargez-le avant de réessayer.",
} as const;

// ── Activity log ────────────────────────────────────────────────────────────
// Rendered verbatim by the «Activité du jour» screen (V1.1). Each sentence
// names the patient and the amount; update/remove name both amounts, so a
// deleted payment leaves a trail of what it was.

export const PAYMENT_ACTIVITY = {
  created: (patient: string, amount: string) =>
    `Paiement de ${amount} enregistré pour ${patient}.`,
  updated: (patient: string, before: string, after: string) =>
    before === after
      ? `Paiement de ${after} modifié pour ${patient}.`
      : `Paiement de ${patient} modifié : ${before} → ${after}.`,
  /** `after` is the zero amount, formatted by the caller. */
  removed: (patient: string, before: string, after: string) =>
    `Paiement de ${patient} supprimé : ${before} → ${after}.`,
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const PAYMENT_FIELD_LABELS = {
  patient: "Patient",
  amount: "Montant",
  method: "Mode de paiement",
  paidDate: "Date",
  paidTime: "Heure",
  treatment: "Acte concerné",
  insurer: "Assurance",
  reference: "Référence",
  notes: "Notes",
} as const;

export const PAYMENT_FIELD_PLACEHOLDERS = {
  patient: "Rechercher un patient…",
  treatment: "Aucun acte — sur le compte du patient",
  insurer: "Choisir l’assurance",
  reference: "ex. n° de chèque, de virement, de dossier",
  date: "Choisir une date",
  notes: "Informations utiles pour l’équipe",
} as const;

export const PAYMENT_COPY = {
  pageTitle: "Paiements",
  newButton: "Encaisser",
  dossierNewButton: "Nouveau paiement",
  newTitle: "Encaisser un paiement",
  newDescription:
    "Le paiement est porté au compte du patient. L’affecter à un acte est facultatif.",
  editTitle: "Modifier le paiement",
  editDescription:
    "Le patient d’un paiement ne change pas : un paiement saisi sur le mauvais patient est supprimé puis ressaisi.",
  created: "Paiement enregistré",
  updated: "Paiement mis à jour",
  removed: "Paiement supprimé",
  save: "Encaisser",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",
  cancel: "Annuler",
  edit: "Modifier",
  remove: "Supprimer",
  openDossier: "Voir le dossier",
  actionsLabel: "Actions du paiement",
  removeTitle: "Supprimer ce paiement ?",
  removeDescription: (amount: string) =>
    `Le paiement de ${amount} est effacé définitivement. Le reste à payer du patient augmente d’autant (ou son avance diminue d’autant). Une trace est conservée dans le journal d’activité.`,
  advanceTitle: "Enregistrer une avance ?",
  advanceDescription: (excess: string) =>
    `Ce paiement dépasse le reste à payer de ${excess}. L’enregistrer comme avance ?`,
  searchPlaceholder: "Rechercher un patient, une référence…",
  searchLabel: "Rechercher un paiement",
  allMethods: "Tous les modes",
  allInsurers: "Toutes les assurances",
  from: "Du",
  to: "Au",
  clearFilters: "Effacer les filtres",
  emptyTitle: "Aucun paiement",
  emptyDefault: "Aucun paiement pour le moment.",
  emptyFiltered:
    "Aucun paiement ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  loadingTitle: "Chargement des paiements",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des paiements n’a pas pu être chargée. Veuillez réessayer.",
  noTreatment: "—",
  noInsurer: "—",
  noReference: "—",
  noTreatmentFound: "Aucun acte facturé pour ce patient.",
  currentBalance: "Solde actuel",
  treatmentRemaining: "reste",
  inactiveInsurer: "(inactive)",
  clearDate: "Effacer la date",
  truncated: (shown: number, total: number) =>
    `Les ${shown} paiements les plus récents sur ${total} sont affichés.`,
} as const;

export const PAYMENT_COLUMN_HEADERS = {
  date: "Date",
  patient: "Patient",
  method: "Mode",
  treatment: "Acte",
  reference: "Référence",
  insurer: "Assurance",
  amount: "Montant",
} as const;

/** The admin header. No «Revenu net»: it needs charges (V1.1). */
export const PAYMENT_SUMMARY_LABELS = {
  collected: "Total encaissé",
  outstanding: "Reste à encaisser",
  advances: "Avances",
  outstandingHint: "Toutes dettes patients confondues, à ce jour",
  advancesHint: "Crédits des patients ayant payé d’avance, à ce jour",
  currentMonth: "Ce mois-ci",
  period: (from: string, to: string) => `Du ${from} au ${to}`,
  since: (from: string) => `Depuis le ${from}`,
  until: (to: string) => `Jusqu’au ${to}`,
  count: (n: number) => `${n} ${n > 1 ? "paiements" : "paiement"}`,
} as const;
