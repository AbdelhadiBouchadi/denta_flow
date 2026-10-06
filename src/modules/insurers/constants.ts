/**
 * The only place French copy exists for this slice (06-ui.md §10).
 */

export const INSURER_STATUS_LABELS = {
  active: "Actif",
  inactive: "Inactif",
} as const;

/** Appended to an inactive insurer wherever it is still listed (the filter). */
export const INACTIVE_INSURER_SUFFIX = "(inactive)";

export const INSURER_FIELD_LABELS = {
  name: "Nom",
} as const;

export const INSURER_FIELD_PLACEHOLDERS = {
  name: "ex. CNSS, CNOPS, SANLAM, AXA",
} as const;

/** Zod messages — rendered verbatim by <FieldError />. */
export const INSURER_VALIDATION_MESSAGES = {
  nameRequired: "Le nom est obligatoire",
  nameTooLong: "Le nom est trop long",
} as const;

/** `TRPCError` messages thrown by `insurers.*`. */
export const INSURER_SERVER_ERRORS = {
  notFound: "Assurance introuvable.",
  duplicateName: "Une assurance porte déjà ce nom.",
} as const;

export const INSURER_COPY = {
  sectionTitle: "Assurances",
  sectionDescription:
    "Les mutuelles et organismes proposés dans le dossier patient. Une assurance désactivée reste visible sur les patients qui l’ont déjà.",
  add: "Ajouter",
  adminOnly: "Seul un administrateur peut modifier ces réglages.",
  actionsLabel: "Actions sur l’assurance",

  newTitle: "Nouvelle assurance",
  newDescription: "Elle sera proposée dans la fiche de chaque patient.",
  editTitle: "Modifier l’assurance",
  editDescription:
    "Le nouveau nom s’affiche sur tous les patients concernés, y compris sur leurs documents.",

  edit: "Modifier",
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Assurance créée",
  updated: "Assurance mise à jour",
  deactivated: "Assurance désactivée",
  reactivated: "Assurance réactivée",

  emptyTitle: "Aucune assurance pour le moment.",
  emptyDescription:
    "Ajoutez les mutuelles de vos patients : CNSS, CNOPS, assurances privées…",
  loadingTitle: "Chargement des assurances",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des assurances n’a pas pu être chargée. Veuillez réessayer.",
} as const;

export const INSURER_COLUMN_HEADERS = {
  name: "Nom",
  status: "Statut",
  patientCount: "Patients",
  actions: "Actions",
} as const;

/** «1 patient», «0 patient», «3 patients» — French singular below 2. */
export const formatPatientCount = (count: number) =>
  `${count} patient${count >= 2 ? "s" : ""}`;
