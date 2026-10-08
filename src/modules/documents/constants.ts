import type { StatusTone } from "@/components/shared/status-badge";
import { DocumentType, type GeneratedDocumentType } from "./types";

/**
 * The only place French copy for this slice exists — the screens, the server
 * errors, the activity sentences and every word printed on a PDF. Never
 * inline one of these in a component (06-ui.md §10).
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** One entry per `document_type` value, the future ones included. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.Invoice]: "Facture",
  [DocumentType.Quote]: "Devis",
  [DocumentType.CareSheet]: "Feuille de soins",
  [DocumentType.Prescription]: "Ordonnance",
  [DocumentType.Certificate]: "Certificat",
};

export const DOCUMENT_TYPE_TONES: Record<DocumentType, StatusTone> = {
  [DocumentType.Invoice]: "brand",
  [DocumentType.Quote]: "info",
  [DocumentType.CareSheet]: "neutral",
  [DocumentType.Prescription]: "neutral",
  [DocumentType.Certificate]: "neutral",
};

/**
 * The types that exist today — what the filter lists and the nuqs / zod
 * parsers accept. V1.1 adds its types here when it ships their generator.
 */
export const GENERATED_DOCUMENT_TYPE_VALUES = [
  DocumentType.Invoice,
  DocumentType.Quote,
] as const satisfies readonly GeneratedDocumentType[];

export const DOCUMENT_TYPE_OPTIONS = GENERATED_DOCUMENT_TYPE_VALUES.map(
  (value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }),
);

/** «F-2026-0001», «D-2026-0001». */
export const DOCUMENT_NUMBER_PREFIXES: Record<GeneratedDocumentType, string> = {
  [DocumentType.Invoice]: "F",
  [DocumentType.Quote]: "D",
};

// ── Limits ──────────────────────────────────────────────────────────────────

/** The dossier's «Documents» tab shows at most this many, newest first. */
export const PATIENT_DOCUMENTS_LIMIT = 200;

/** An invoice or a quote names at most this many actes. */
export const DOCUMENT_MAX_LINES = 200;

/** How many times a generation retries after losing a number to a concurrent one. */
export const DOCUMENT_NUMBER_MAX_ATTEMPTS = 5;

/** A devis is valid this many days by default, counted on the clinic calendar. */
export const QUOTE_DEFAULT_VALIDITY_DAYS = 30;

/** The logo fetch gives up after this long; the header falls back to text. */
export const LOGO_FETCH_TIMEOUT_MS = 3000;

// ── Validation and server copy ──────────────────────────────────────────────

export const DOCUMENT_VALIDATION_MESSAGES = {
  patientRequired: "Patient requis",
  emptySelection: "Sélectionnez au moins un acte.",
  tooManyLines: `Un document ne peut pas contenir plus de ${DOCUMENT_MAX_LINES} actes.`,
  validUntilInvalid: "Choisissez une date de validité valide",
  validUntilPast: "La date de validité ne peut pas être dans le passé",
} as const;

export const DOCUMENT_SERVER_ERRORS = {
  notFound: "Document introuvable.",
  patientNotFound: "Patient introuvable.",
  emptySelection: DOCUMENT_VALIDATION_MESSAGES.emptySelection,
  notOwned:
    "Un des actes sélectionnés n’existe plus ou n’appartient pas à ce patient. Actualisez la page, puis réessayez.",
  notBillable:
    "Seuls les actes en cours ou terminés peuvent être facturés : un acte prévu ou annulé ne figure jamais sur une facture.",
  notPlanned:
    "Seuls les actes prévus peuvent figurer sur un devis.",
  numberUnavailable:
    "Le numéro du document n’a pas pu être attribué. Réessayez dans un instant.",
  missingReference:
    "Le patient ou un acte sélectionné n’existe plus. Actualisez la page, puis réessayez.",
  unreadableSnapshot:
    "Ce document est illisible : son contenu enregistré ne correspond à aucun format connu.",
} as const;

// ── Activity log ────────────────────────────────────────────────────────────
// Rendered verbatim by the «Activité du jour» screen (V1.1). Type, number and
// patient — a deleted document leaves a trail of what it was.

const ISSUED: Record<GeneratedDocumentType, string> = {
  [DocumentType.Invoice]: "générée",
  [DocumentType.Quote]: "généré",
};

const REMOVED: Record<GeneratedDocumentType, string> = {
  [DocumentType.Invoice]: "supprimée",
  [DocumentType.Quote]: "supprimé",
};

export const DOCUMENT_ACTIVITY = {
  generated: (type: GeneratedDocumentType, number: string, patient: string) =>
    `${DOCUMENT_TYPE_LABELS[type]} ${number} ${ISSUED[type]} pour ${patient}.`,
  removed: (type: GeneratedDocumentType, number: string, patient: string) =>
    `${DOCUMENT_TYPE_LABELS[type]} ${number} de ${patient} ${REMOVED[type]} (numéro non réattribué).`,
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const DOCUMENT_COPY = {
  pageTitle: "Documents",
  generateInvoice: "Générer une facture",
  generateQuote: "Générer un devis",
  invoiceTitle: "Générer une facture",
  invoiceDescription:
    "Les actes en cours et terminés du patient. La facture est figée à sa génération : la modifier ensuite est impossible.",
  quoteTitle: "Générer un devis",
  quoteDescription:
    "Les actes prévus du patient. Le devis ne mentionne aucun paiement.",
  noBillable: "Aucun acte facturable.",
  noPlanned: "Aucun acte prévu.",
  selectAll: "Tout sélectionner",
  selectedCount: (selected: number, total: number) =>
    `${selected} sur ${total} sélectionné${selected > 1 ? "s" : ""}`,
  total: "Total",
  validUntil: "Valable jusqu’au",
  validUntilPlaceholder: "Choisir une date",
  generate: "Générer",
  generating: "Génération…",
  cancel: "Annuler",
  generated: "Document généré",
  popupBlocked:
    "Le document est prêt, mais le navigateur a bloqué son ouverture. Ouvrez-le depuis la liste.",
  open: "Ouvrir",
  download: "Télécharger",
  remove: "Supprimer",
  removed: "Document supprimé",
  openDossier: "Voir le dossier",
  actionsLabel: "Actions du document",
  removeTitle: "Supprimer ce document ?",
  removeDescription: (label: string, number: string) =>
    `${label} ${number} est retiré du registre. Son numéro n’est pas réattribué : le prochain document en prendra un nouveau, et le trou restera visible dans la numérotation. Une trace est conservée dans le journal d’activité.`,
  searchPlaceholder: "Rechercher un patient, un numéro…",
  searchLabel: "Rechercher un document",
  allTypes: "Tous les types",
  from: "Du",
  to: "Au",
  clearFilters: "Effacer les filtres",
  emptyTitle: "Aucun document",
  emptyDefault: "Aucun document pour le moment.",
  emptyFiltered:
    "Aucun document ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  loadingTitle: "Chargement des documents",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des documents n’a pas pu être chargée. Veuillez réessayer.",
  noNumber: "—",
  noCode: "—",
  truncated: (shown: number, total: number) =>
    `Les ${shown} documents les plus récents sur ${total} sont affichés.`,
} as const;

export const DOCUMENT_COLUMN_HEADERS = {
  patient: "Patient",
  type: "Type",
  number: "N°",
  fileName: "Nom du fichier",
  date: "Date",
  generatedBy: "Généré par",
  acte: "Acte",
  amount: "Montant",
} as const;

// ── Printed copy (the PDF) ──────────────────────────────────────────────────

export const DOCUMENT_PDF_COPY = {
  title: (type: GeneratedDocumentType, number: string) =>
    `${DOCUMENT_TYPE_LABELS[type].toLocaleUpperCase("fr-FR")} N° ${number}`,
  date: "Date",
  validUntil: "Valable jusqu’au",
  patient: "Patient",
  patientCode: "Dossier",
  cin: "CIN",
  phone: "Tél.",
  columns: {
    date: "Date",
    label: "Acte",
    code: "Code",
    teeth: "Dents",
    amount: "Montant",
  },
  total: "Total",
  accountSituation: (date: string) => `Situation du compte au ${date}`,
  accountBilled: "Total des actes facturés au compte",
  paidToDate: "Réglé à ce jour",
  quoteMention: "Devis non contractuel hors acceptation écrite.",
  practitioner: "Praticien",
  inpe: "INPE",
  signature: "Cachet et signature",
  page: (page: number, total: number) => `Page ${page}/${total}`,
  identifiers: {
    ice: "ICE",
    patente: "Patente",
    fiscalId: "IF",
    cnssNumber: "CNSS",
  },
  noTeeth: "",
} as const;
