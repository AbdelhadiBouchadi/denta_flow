import { CERTIFICATE_BODY_MAX } from "@/modules/documents/constants";

/**
 * The only place French copy for this slice exists — the builder, the
 * template editor, the renderer's errors (06-ui.md §10).
 *
 * The three seeded templates (seed.ts) and every wording here are a starting
 * point «à valider» by the practising dentist (prompts/29).
 */

// ── Variables ───────────────────────────────────────────────────────────────

/**
 * The variables a certificate body may use, written `{{name}}`. French keys:
 * the dentist types them in the template editor. Rendered by variables.ts,
 * on the server authoritatively and in the builder for the preview.
 */
export const CERTIFICATE_VARIABLES = [
  "patient",
  "cin",
  "date",
  "debut",
  "fin",
  "jours",
  "praticien",
] as const;

export type CertificateVariable = (typeof CERTIFICATE_VARIABLES)[number];

/** What each variable becomes — listed as chips in the template editor. */
export const CERTIFICATE_VARIABLE_DESCRIPTIONS: Record<
  CertificateVariable,
  string
> = {
  patient: "Nom complet du patient",
  cin: "CIN du patient (la ligne est retirée si le CIN est vide)",
  date: "Date du jour, en toutes lettres",
  debut: "Date de début de la période",
  fin: "Date de fin de la période",
  jours: "Nombre de jours, calculé à partir des dates",
  praticien: "Nom du praticien signataire",
};

/** The period variables: the builder shows its date fields when one is used. */
export const CERTIFICATE_PERIOD_VARIABLES: readonly CertificateVariable[] = [
  "debut",
  "fin",
  "jours",
];

/** What to fill in when a variable has no value — completes the error below. */
const MISSING_HINTS: Partial<Record<CertificateVariable, string>> = {
  debut: "renseignez la date de début",
  fin: "renseignez la date de fin",
  jours: "renseignez les dates ou le nombre de jours",
};

export const CERTIFICATE_RENDER_ERRORS = {
  unknown: (name: string) =>
    `La variable « {{${name}}} » n’existe pas. Variables possibles : ${CERTIFICATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}.`,
  missing: (name: CertificateVariable) =>
    `La variable « {{${name}}} » n’a pas de valeur${MISSING_HINTS[name] ? ` : ${MISSING_HINTS[name]}` : ""}.`,
  malformed:
    "Le texte contient des accolades « {{ » ou « }} » qui ne forment pas une variable. Corrigez-les ou retirez-les.",
  rangeInverted:
    "La date de fin doit être identique ou postérieure à la date de début.",
  empty: "Le texte du certificat est vide.",
  tooLong: `Le certificat ne peut pas dépasser ${CERTIFICATE_BODY_MAX} caractères.`,
} as const;

// ── Templates ───────────────────────────────────────────────────────────────

export const CERTIFICATE_TEMPLATE_TITLE_MAX = 120;

export const CERTIFICATE_TEMPLATE_MESSAGES = {
  titleRequired: "Indiquez un titre.",
  titleTooLong: `Le titre ne peut pas dépasser ${CERTIFICATE_TEMPLATE_TITLE_MAX} caractères.`,
  bodyRequired: "Le texte du modèle est vide.",
  bodyTooLong: `Le modèle ne peut pas dépasser ${CERTIFICATE_BODY_MAX} caractères.`,
} as const;

export const CERTIFICATE_TEMPLATE_SERVER_ERRORS = {
  notFound: "Modèle de certificat introuvable.",
  changedMeanwhile:
    "Ce modèle a été modifié entre-temps par un autre utilisateur. Rechargez-le, puis réessayez.",
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const CERTIFICATE_COPY = {
  // Dossier
  newCertificate: "Nouveau certificat",
  builderTitle: "Nouveau certificat médical",
  builderDescription:
    "Le texte est vérifié et complété par le serveur : l’identité du patient, la date, le numéro et le praticien sont toujours générés automatiquement.",
  template: "Modèle",
  freeText: "Texte libre (sans modèle)",
  startDate: "Du",
  endDate: "Au",
  days: "Nombre de jours",
  daysComputed: (days: number) =>
    `${days} jour${days > 1 ? "s" : ""}, calculé${days > 1 ? "s" : ""} à partir des dates`,
  body: "Texte du certificat",
  bodyHint:
    "Les variables entre accolades sont remplacées à la génération. Aperçu ci-dessous.",
  preview: "Aperçu",
  previewError: "Aperçu indisponible",
  characters: (count: number, max: number) => `${count} / ${max} caractères`,
  noHeader: "Papier à en-tête",
  noHeaderHint:
    "Masque l’en-tête du cabinet et garde sa place, pour imprimer sur du papier déjà imprimé.",
  generate: "Générer",
  generating: "Génération…",
  cancel: "Annuler",
  chooseDate: "Choisir une date",
  // Settings
  sectionTitle: "Modèles de certificats",
  sectionDescription:
    "Les trois modèles proposés à la rédaction d’un certificat. Un certificat déjà émis garde son texte : modifier un modèle ne change aucun document existant.",
  readOnly:
    "Seuls un administrateur ou un dentiste peuvent modifier les modèles.",
  variablesTitle: "Variables disponibles",
  edit: "Modifier",
  editTitle: "Modifier le modèle",
  editDescription:
    "Texte simple. Les variables entre accolades sont remplacées à la génération du certificat.",
  title: "Titre",
  bodyLabel: "Texte",
  active: "Proposé à la rédaction",
  inactive: "Masqué",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "Modèle enregistré",
  emptyTitle: "Aucun modèle",
  emptyDescription: "Les modèles de certificats n’ont pas encore été créés.",
  loadingTitle: "Chargement des modèles",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription: "Les modèles n’ont pas pu être chargés. Veuillez réessayer.",
} as const;
