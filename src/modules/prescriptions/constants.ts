import type { StatusTone } from "@/components/shared/status-badge";
import { PRESCRIPTION_MAX_LINES } from "@/modules/documents/constants";
import { MedicationStatusFilter } from "./types";

/**
 * The only place French copy for this slice exists (06-ui.md §10).
 *
 * The seeded medications and packs (seed.ts) are a starting point «à
 * valider» by the practising dentist (prompts/29). Nothing here is a dose.
 */

// ── Forms ───────────────────────────────────────────────────────────────────

/**
 * The galenic forms the form offers. Free text in the database (prompts/29):
 * the list is a convenience, a clinic may type another form.
 */
export const MEDICATION_FORMS = [
  "comprimé",
  "comprimé effervescent",
  "gélule",
  "sachet",
  "sirop",
  "suspension buvable",
  "solution",
  "bain de bouche",
  "gel",
  "pommade",
  "collutoire",
  "injectable",
] as const;

// ── Limits ──────────────────────────────────────────────────────────────────

export const MEDICATION_FIELD_MAX = {
  name: 120,
  form: 60,
  strength: 40,
  posology: 300,
  duration: 80,
} as const;

export const PACK_FIELD_MAX = {
  name: 80,
  notes: 500,
  remark: 300,
} as const;

/** A pack holds 1 to this many items: it must fit on one ordonnance. */
export const PACK_MAX_ITEMS = PRESCRIPTION_MAX_LINES;

/** How many packs `getMany` returns at most — a clinic keeps a handful. */
export const PACKS_LIMIT = 100;

/** The builder's medication picker loads at most this many active medications. */
export const MEDICATION_PICKER_LIMIT = 100;

// ── Status filter ───────────────────────────────────────────────────────────

export const MEDICATION_STATUS_LABELS: Record<MedicationStatusFilter, string> = {
  [MedicationStatusFilter.All]: "Tous les statuts",
  [MedicationStatusFilter.Active]: "Actifs",
  [MedicationStatusFilter.Inactive]: "Désactivés",
};

export const MEDICATION_STATUS_FILTER_OPTIONS = Object.values(
  MedicationStatusFilter,
).map((value) => ({ value, label: MEDICATION_STATUS_LABELS[value] }));

export const MEDICATION_ACTIVE_BADGE: Record<
  "active" | "inactive",
  { label: string; tone: StatusTone }
> = {
  active: { label: "Actif", tone: "success" },
  inactive: { label: "Désactivé", tone: "neutral" },
};

// ── Validation and server copy ──────────────────────────────────────────────

export const MEDICATION_VALIDATION_MESSAGES = {
  nameRequired: "Indiquez le nom du médicament.",
  nameTooLong: `Le nom ne peut pas dépasser ${MEDICATION_FIELD_MAX.name} caractères.`,
  formRequired: "Indiquez la forme.",
  formTooLong: `La forme ne peut pas dépasser ${MEDICATION_FIELD_MAX.form} caractères.`,
  strengthTooLong: `Le dosage ne peut pas dépasser ${MEDICATION_FIELD_MAX.strength} caractères.`,
  posologyTooLong: `La posologie ne peut pas dépasser ${MEDICATION_FIELD_MAX.posology} caractères.`,
  durationTooLong: `La durée ne peut pas dépasser ${MEDICATION_FIELD_MAX.duration} caractères.`,
} as const;

export const PACK_VALIDATION_MESSAGES = {
  nameRequired: "Indiquez le nom du pack.",
  nameTooLong: `Le nom ne peut pas dépasser ${PACK_FIELD_MAX.name} caractères.`,
  notesTooLong: `Les notes ne peuvent pas dépasser ${PACK_FIELD_MAX.notes} caractères.`,
  itemsEmpty: "Ajoutez au moins un médicament au pack.",
  itemsTooMany: `Un pack ne peut pas contenir plus de ${PACK_MAX_ITEMS} médicaments.`,
  medicationRequired: "Choisissez un médicament.",
  posologyRequired: "Indiquez la posologie.",
  posologyTooLong: `La posologie ne peut pas dépasser ${MEDICATION_FIELD_MAX.posology} caractères.`,
  durationTooLong: `La durée ne peut pas dépasser ${MEDICATION_FIELD_MAX.duration} caractères.`,
  remarkTooLong: `La remarque ne peut pas dépasser ${PACK_FIELD_MAX.remark} caractères.`,
} as const;

export const PRESCRIPTION_SERVER_ERRORS = {
  medicationNotFound: "Médicament introuvable.",
  duplicateMedication:
    "Ce médicament existe déjà avec ce dosage (les majuscules et les accents ne comptent pas).",
  medicationChangedMeanwhile:
    "Ce médicament a été modifié entre-temps par un autre utilisateur. Rechargez la liste, puis réessayez.",
  packNotFound: "Pack introuvable.",
  duplicatePack: "Un pack porte déjà ce nom.",
  packMedicationMissing:
    "Un des médicaments du pack n’existe plus. Actualisez la page, puis réessayez.",
} as const;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const PRESCRIPTION_COPY = {
  // Dossier — the ordonnance builder
  newPrescription: "Nouvelle ordonnance",
  builderTitle: "Nouvelle ordonnance",
  builderDescription:
    "Ajoutez les médicaments un par un ou depuis un pack, puis ajustez chaque ligne. L’ordonnance est figée à sa génération.",
  allergiesTitle: "Allergies du patient",
  addMedication: "Ajouter un médicament",
  medicationPlaceholder: "Choisir un médicament…",
  addFreeLine: "Ajouter une ligne libre",
  addPack: "Ajouter un pack",
  packPlaceholder: "Choisir un pack…",
  packAdded: (name: string, count: number) =>
    `Pack « ${name} » ajouté (${count} ligne${count > 1 ? "s" : ""}).`,
  packTooLong: `Le pack dépasse la limite de ${PRESCRIPTION_MAX_LINES} lignes par ordonnance.`,
  noLines: "Aucune ligne pour le moment.",
  lineCount: (count: number) =>
    `${count} ligne${count > 1 ? "s" : ""} sur ${PRESCRIPTION_MAX_LINES}`,
  lineNumber: (index: number) => `Ligne ${index}`,
  label: "Médicament",
  strength: "Dosage",
  posology: "Posologie",
  posologyPlaceholder: "Ex. : 1 comprimé 3 fois par jour",
  duration: "Durée",
  durationPlaceholder: "Ex. : 5 jours",
  remark: "Remarque",
  moveUp: "Monter la ligne",
  moveDown: "Descendre la ligne",
  removeLine: "Retirer la ligne",
  noHeader: "Papier à en-tête",
  noHeaderHint:
    "Masque l’en-tête du cabinet et garde sa place, pour imprimer sur du papier déjà imprimé.",
  generate: "Générer",
  generating: "Génération…",
  cancel: "Annuler",
  inactiveMedication: "Médicament désactivé",
  // Settings — medications
  sectionTitle: "Médicaments et packs",
  sectionDescription:
    "Le catalogue proposé à la rédaction des ordonnances. Une ordonnance déjà émise garde ses lignes : modifier un médicament ou un pack ne change aucun document existant.",
  readOnly:
    "Seuls un administrateur ou un dentiste peuvent modifier les médicaments et les packs.",
  medicationsTitle: "Médicaments",
  addMedicationButton: "Ajouter un médicament",
  newMedicationTitle: "Nouveau médicament",
  editMedicationTitle: "Modifier le médicament",
  medicationDialogDescription:
    "La posologie et la durée par défaut pré-remplissent la ligne de l’ordonnance ; elles restent modifiables à chaque fois.",
  name: "Nom (molécule)",
  form: "Forme",
  formPlaceholder: "Choisir une forme",
  defaultPosology: "Posologie par défaut",
  defaultDuration: "Durée par défaut",
  searchLabel: "Rechercher un médicament",
  searchPlaceholder: "Rechercher un médicament…",
  clearFilters: "Effacer les filtres",
  statusFilterLabel: "Filtrer par statut",
  edit: "Modifier",
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  deactivated: "Médicament désactivé",
  reactivated: "Médicament réactivé",
  medicationCreated: "Médicament ajouté",
  medicationUpdated: "Médicament modifié",
  actionsLabel: "Actions du médicament",
  noValue: "—",
  emptyMedicationsTitle: "Aucun médicament",
  emptyMedicationsDescription:
    "Ajoutez les médicaments que le cabinet prescrit le plus souvent.",
  noResultTitle: "Aucun résultat",
  noResultDescription:
    "Aucun médicament ne correspond à ces critères. Modifiez la recherche ou effacez les filtres.",
  // Settings — packs
  packsTitle: "Packs d’ordonnance",
  packsDescription:
    "Un pack ajoute plusieurs lignes d’un coup à une ordonnance, chacune restant modifiable.",
  addPackButton: "Créer un pack",
  newPackTitle: "Nouveau pack",
  editPackTitle: "Modifier le pack",
  packDialogDescription:
    "Les lignes du pack sont copiées dans l’ordonnance, où elles restent modifiables.",
  packName: "Nom du pack",
  packNotes: "Notes",
  packItems: "Médicaments du pack",
  packItemCount: (count: number) =>
    `${count} médicament${count > 1 ? "s" : ""}`,
  removePack: "Supprimer",
  removePackTitle: "Supprimer ce pack ?",
  removePackDescription: (name: string) =>
    `Le pack « ${name} » et ses lignes sont supprimés. Les médicaments restent au catalogue, et les ordonnances déjà émises ne changent pas.`,
  packCreated: "Pack créé",
  packUpdated: "Pack modifié",
  packRemoved: "Pack supprimé",
  packActionsLabel: "Actions du pack",
  emptyPacksTitle: "Aucun pack",
  emptyPacksDescription:
    "Créez un pack pour les prescriptions que vous rédigez souvent.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  loadingTitle: "Chargement des médicaments",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "Les médicaments et les packs n’ont pas pu être chargés. Veuillez réessayer.",
} as const;

export const MEDICATION_COLUMN_HEADERS = {
  name: "Médicament",
  form: "Forme",
  defaults: "Posologie par défaut",
  status: "Statut",
  actions: "Actions",
} as const;
