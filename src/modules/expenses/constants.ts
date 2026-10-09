import type { StatusTone } from "@/components/shared/status-badge";
import { ExpenseCategory } from "./types";

/**
 * The only place French copy for this slice exists. Never inline one of these
 * labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 */

// ── Categories ──────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.Supplies]: "Fournitures",
  [ExpenseCategory.Lab]: "Laboratoire",
  [ExpenseCategory.Rent]: "Loyer",
  [ExpenseCategory.Utilities]: "Eau, électricité, téléphone",
  [ExpenseCategory.Salaries]: "Salaires",
  [ExpenseCategory.Equipment]: "Équipement",
  [ExpenseCategory.Maintenance]: "Maintenance",
  [ExpenseCategory.Taxes]: "Impôts et taxes",
  [ExpenseCategory.Other]: "Autres",
};

/**
 * The badge palette, from the shared tones (tokens only). Tones repeat — nine
 * categories, six tones: the label carries the meaning, the tone only groups
 * (fixed costs, clinical purchases, the State, the rest).
 */
export const EXPENSE_CATEGORY_TONES: Record<ExpenseCategory, StatusTone> = {
  [ExpenseCategory.Supplies]: "brand",
  [ExpenseCategory.Lab]: "brand",
  [ExpenseCategory.Rent]: "info",
  [ExpenseCategory.Utilities]: "info",
  [ExpenseCategory.Salaries]: "warning",
  [ExpenseCategory.Equipment]: "success",
  [ExpenseCategory.Maintenance]: "success",
  [ExpenseCategory.Taxes]: "danger",
  [ExpenseCategory.Other]: "neutral",
};

/** The literal union the nuqs parser and the Zod enum accept. */
export const EXPENSE_CATEGORY_VALUES = [
  ExpenseCategory.Supplies,
  ExpenseCategory.Lab,
  ExpenseCategory.Rent,
  ExpenseCategory.Utilities,
  ExpenseCategory.Salaries,
  ExpenseCategory.Equipment,
  ExpenseCategory.Maintenance,
  ExpenseCategory.Taxes,
  ExpenseCategory.Other,
] as const;

export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORY_VALUES.map(
  (value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] }),
);

// ── Limits ──────────────────────────────────────────────────────────────────

export const EXPENSE_LABEL_MAX = 200;
export const EXPENSE_SUPPLIER_MAX = 120;
export const EXPENSE_NOTES_MAX = 2000;

// ── Validation and server copy ──────────────────────────────────────────────

export const EXPENSE_VALIDATION_MESSAGES = {
  labelRequired: "Indiquez le libellé de la charge",
  labelTooLong: "Le libellé est trop long",
  categoryInvalid: "Choisissez une catégorie",
  amountInvalid: "Le montant doit être un nombre entier de centimes",
  amountPositive: "Le montant doit être supérieur à zéro",
  dateInvalid: "Choisissez une date valide",
  inFuture: "La date de la charge ne peut pas être dans le futur",
  supplierTooLong: "Le nom du fournisseur est trop long",
  notesTooLong: "Les notes sont trop longues",
} as const;

export const EXPENSE_SERVER_ERRORS = {
  notFound: "Charge introuvable.",
  /** Optimistic concurrency — the same family as payments and actes. */
  changedMeanwhile:
    "Cette charge a été modifiée entre-temps. Rechargez-la avant de réessayer.",
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const EXPENSE_FIELD_LABELS = {
  label: "Libellé",
  category: "Catégorie",
  amount: "Montant",
  spentDate: "Date",
  supplier: "Fournisseur",
  notes: "Notes",
} as const;

export const EXPENSE_FIELD_PLACEHOLDERS = {
  label: "ex. Loyer d’octobre, facture d’électricité",
  category: "Choisir une catégorie",
  date: "Choisir une date",
  supplier: "ex. ONEE, Laboratoire Argana",
  notes: "N° de facture, échéance, informations utiles",
} as const;

export const EXPENSE_COPY = {
  pageTitle: "Charges",
  newButton: "Nouvelle charge",
  newTitle: "Nouvelle charge",
  newDescription:
    "Une dépense du cabinet, datée du jour où elle a été réglée. Elle est déduite du bénéfice net de la période.",
  duplicateTitle: "Dupliquer la charge",
  duplicateDescription:
    "Une nouvelle charge, reprise de la précédente et datée d’aujourd’hui. Vérifiez le montant avant d’enregistrer.",
  editTitle: "Modifier la charge",
  editDescription: "La modification change le total des charges et le bénéfice net de sa période.",
  created: "Charge enregistrée",
  updated: "Charge mise à jour",
  removed: "Charge supprimée",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",
  cancel: "Annuler",
  edit: "Modifier",
  duplicate: "Dupliquer",
  remove: "Supprimer",
  actionsLabel: "Actions de la charge",
  removeTitle: "Supprimer cette charge ?",
  removeDescription: (amount: string) =>
    `La charge de ${amount} est effacée définitivement. Le total des charges baisse d’autant et le bénéfice net de sa période augmente d’autant.`,
  searchPlaceholder: "Rechercher un libellé, un fournisseur…",
  searchLabel: "Rechercher une charge",
  allCategories: "Toutes les catégories",
  from: "Du",
  to: "Au",
  clearFilters: "Effacer les filtres",
  emptyTitle: "Aucune charge",
  emptyDefault: "Aucune charge pour le moment.",
  emptyFiltered:
    "Aucune charge ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  noSupplier: "—",
  loadingTitle: "Chargement des charges",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des charges n’a pas pu être chargée. Veuillez réessayer.",
  forbiddenTitle: "Accès réservé à l’administrateur",
  forbiddenHint:
    "Les charges et le bénéfice du cabinet ne sont consultables que par l’administrateur.",
  retry: "Réessayer",
} as const;

export const EXPENSE_COLUMN_HEADERS = {
  date: "Date",
  label: "Libellé",
  category: "Catégorie",
  amount: "Montant",
} as const;

export const EXPENSE_SUMMARY_LABELS = {
  total: "Total des charges",
  count: "Nombre",
  topCategory: "Première catégorie",
  breakdownTitle: "Répartition par catégorie",
  noTopCategory: "—",
  allTime: "Depuis le début",
  period: (from: string, to: string) => `Du ${from} au ${to}`,
  since: (from: string) => `Depuis le ${from}`,
  until: (to: string) => `Jusqu’au ${to}`,
  countValue: (n: number) => `${n} ${n > 1 ? "charges" : "charge"}`,
  previousPeriod: "Période précédente",
  /** Non-breaking space before «%», French typography. */
  share: (percent: number) => `${percent} %`,
} as const;
