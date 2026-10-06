import type { StatusTone } from "@/components/shared/status-badge";
import { NgapXrayRequirement, ServiceCategory, ServiceStatusFilter } from "./types";

/**
 * The only place French copy exists for this slice. Never inline one of these
 * labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 *
 * NGAP chapter names are NOT here: they come from ngap-acts.json, through tRPC.
 */

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  [ServiceCategory.Consultation]: "Consultation",
  [ServiceCategory.Restorative]: "Soins conservateurs",
  [ServiceCategory.Endodontics]: "Endodontie",
  [ServiceCategory.Prosthetics]: "Prothèse",
  [ServiceCategory.Surgery]: "Chirurgie",
  [ServiceCategory.Orthodontics]: "Orthodontie",
  [ServiceCategory.Periodontics]: "Parodontologie",
  [ServiceCategory.Implantology]: "Implantologie",
  [ServiceCategory.Cosmetic]: "Esthétique",
  [ServiceCategory.Other]: "Autre",
};

export const SERVICE_CATEGORY_OPTIONS = Object.entries(
  SERVICE_CATEGORY_LABELS,
).map(([value, label]) => ({ value: value as ServiceCategory, label }));

/** A category badge is information, not a state: every one is neutral. */
export const SERVICE_CATEGORY_TONE: StatusTone = "neutral";

export const SERVICE_STATUS_FILTER_LABELS: Record<ServiceStatusFilter, string> =
  {
    [ServiceStatusFilter.All]: "Tous les statuts",
    [ServiceStatusFilter.Active]: "Actifs",
    [ServiceStatusFilter.Inactive]: "Inactifs",
  };

export const SERVICE_STATUS_FILTER_OPTIONS = Object.entries(
  SERVICE_STATUS_FILTER_LABELS,
).map(([value, label]) => ({ value: value as ServiceStatusFilter, label }));

export const SERVICE_STATUS_LABELS = {
  active: "Actif",
  inactive: "Inactif",
} as const;

export const NGAP_XRAY_LABELS: Record<NgapXrayRequirement, string> = {
  [NgapXrayRequirement.Pre]: "Radiographie pré-opératoire obligatoire",
  [NgapXrayRequirement.PrePost]:
    "Radiographie pré- et post-opératoire obligatoire",
};

/** Bounds shared by the Zod schema and the form's input attributes. */
export const SERVICE_DURATION_MIN = 5;
export const SERVICE_DURATION_MAX = 480;
export const SERVICE_DEFAULT_DURATION = 30;
export const SERVICE_LABEL_MAX = 300;
export const SERVICE_CODE_MAX = 20;
/** 1 000 000,00 DH — a typo guard, far above any real fee. */
export const SERVICE_PRICE_MAX_CENTS = 100_000_000;

/** `searchNgap` result cap, and the import batch cap. */
export const NGAP_SEARCH_MAX_LIMIT = 50;
export const NGAP_PICKER_LIMIT = 20;
export const NGAP_IMPORT_MAX_CODES = 200;

/** Debounce for every search box in this slice. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Zod messages — rendered verbatim by <FieldError />. */
export const SERVICE_VALIDATION_MESSAGES = {
  labelRequired: "Le libellé est obligatoire",
  labelTooLong: "Le libellé est trop long",
  categoryInvalid: "Choisissez une catégorie",
  priceRequired: "Le prix est obligatoire",
  priceInvalid: "Le prix doit être un montant positif ou nul",
  priceTooHigh: "Le prix est trop élevé",
  durationInvalid: `La durée doit être un nombre entier de minutes entre ${SERVICE_DURATION_MIN} et ${SERVICE_DURATION_MAX}`,
  codeTooLong: "Le code est trop long",
  importEmpty: "Sélectionnez au moins un acte",
  importTooMany: `Vous pouvez importer au plus ${NGAP_IMPORT_MAX_CODES} actes à la fois`,
} as const;

/** `TRPCError` messages thrown by `services.*`. */
export const SERVICE_SERVER_ERRORS = {
  notFound: "Acte introuvable.",
  duplicateLabel: "Un acte de cette catégorie porte déjà ce libellé.",
  unknownNgapCode: "Un des codes sélectionnés n’existe pas dans la NGAP.",
} as const;

export const SERVICE_COPY = {
  sectionTitle: "Actes",
  sectionDescription:
    "Le catalogue des actes facturés par le cabinet, avec vos propres honoraires. Un acte désactivé n’est plus proposé, mais les actes déjà enregistrés restent intacts.",
  add: "Ajouter un acte",
  importNgap: "Importer depuis la NGAP",
  adminOnly: "Seul un administrateur peut modifier le catalogue.",
  actionsLabel: "Actions sur l’acte",

  searchLabel: "Rechercher un acte",
  searchPlaceholder: "Rechercher par libellé ou code…",
  allCategories: "Toutes les catégories",
  categoryFilterLabel: "Filtrer par catégorie",
  statusFilterLabel: "Filtrer par statut",
  clearFilters: "Effacer les filtres",

  newTitle: "Nouvel acte",
  newDescription:
    "Partez de la nomenclature NGAP ou saisissez un acte propre au cabinet.",
  editTitle: "Modifier l’acte",
  editDescription: "Le nouveau libellé et le nouveau prix s’appliquent aux prochains actes.",

  edit: "Modifier",
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Acte créé",
  updated: "Acte mis à jour",
  deactivated: "Acte désactivé",
  reactivated: "Acte réactivé",

  emptyTitle: "Aucun acte pour le moment.",
  emptyDescription:
    "Importez les actes de la nomenclature NGAP ou ajoutez vos propres actes.",
  noResultTitle: "Aucun acte trouvé",
  noResultDescription:
    "Aucun acte ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  loadingTitle: "Chargement des actes",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "Le catalogue des actes n’a pas pu être chargé. Veuillez réessayer.",

  priceUnchangedInfo:
    "Modifier le prix n’affecte pas les actes déjà enregistrés.",
} as const;

export const SERVICE_FIELD_LABELS = {
  ngapPicker: "Partir de la nomenclature NGAP",
  label: "Libellé",
  category: "Catégorie",
  nomenclatureCode: "Code NGAP",
  defaultPriceCents: "Prix",
  durationMinutes: "Durée (min)",
} as const;

export const SERVICE_FIELD_PLACEHOLDERS = {
  ngapPicker: "Rechercher un acte ou un code (ex. D706, détartrage)…",
  label: "ex. Pose d’implant, Blanchiment",
  category: "Choisir une catégorie",
  nomenclatureCode: "ex. D700 — laisser vide si hors NGAP",
} as const;

export const NGAP_COPY = {
  pickerEmpty: "Aucun acte de la NGAP ne correspond.",
  pickerLoading: "Recherche…",
  referenceTariff: "Tarif de référence NGAP — à ajuster à vos honoraires",
  referenceTariffHint: "Tarif de référence NGAP :",
  onQuote: "sur devis",
  referenceShort: "Réf.",

  importTitle: "Importer depuis la NGAP",
  importDescription:
    "Choisissez les actes de la nomenclature à ajouter au catalogue.",
  importBanner:
    "Les tarifs de la NGAP sont des tarifs de référence (base de remboursement). Ajustez-les à vos honoraires après l’import.",
  allChapters: "Tous",
  chapterLabel: "Chapitre",
  searchLabel: "Rechercher dans la NGAP",
  searchPlaceholder: "Rechercher un acte ou un code…",
  selectAll: "Tout sélectionner",
  alreadyInCatalogue: "Déjà au catalogue",
  noResult: "Aucun acte de la NGAP ne correspond à cette recherche.",
  importing: "Import…",
  loadError: "La nomenclature n’a pas pu être chargée. Veuillez réessayer.",
} as const;

/** Shown when «Tous» matches more acts than one search returns. */
export const ngapTruncatedMessage = (shown: number, total: number) =>
  `${shown} actes affichés sur ${total}. Choisissez un chapitre ou affinez la recherche.`;

export const SERVICE_COLUMN_HEADERS = {
  label: "Acte",
  category: "Catégorie",
  code: "Code",
  price: "Prix",
  duration: "Durée",
  status: "Statut",
  actions: "Actions",
} as const;

/** «D × 10». The cotation as the nomenclature writes it. */
export const formatNgapCotation = (letter: string, coefficient: number) =>
  `${letter} × ${coefficient}`;

/** «45 min». */
export const formatDuration = (minutes: number) => `${minutes} min`;

/** «Importer 1 acte», «Importer 12 actes». */
export const importButtonLabel = (count: number) =>
  `Importer ${count} acte${count >= 2 ? "s" : ""}`;

/** The import's success toast, with both counts. */
export const importResultMessage = ({
  created,
  skipped,
}: {
  created: number;
  skipped: number;
}) => {
  const createdPart =
    created === 0
      ? "Aucun acte importé"
      : `${created} acte${created >= 2 ? "s" : ""} importé${created >= 2 ? "s" : ""}`;
  if (skipped === 0) return `${createdPart}.`;
  return `${createdPart}, ${skipped} déjà au catalogue.`;
};
