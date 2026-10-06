/**
 * The only place French copy exists for this slice (06-ui.md §10). Every
 * message below reaches a user verbatim — a label, a Zod message, a
 * `TRPCError` or a toast.
 */

export const APPOINTMENT_TYPE_LABEL_MAX = 60;
export const APPOINTMENT_TYPE_DURATION_MIN = 5;
export const APPOINTMENT_TYPE_DURATION_MAX = 480;
export const APPOINTMENT_TYPE_DEFAULT_DURATION = 30;
/** The step the duration input nudges by; any integer in range is accepted. */
export const APPOINTMENT_TYPE_DURATION_STEP = 5;

/** Where the dialog's preview block starts — any morning slot reads right. */
export const PREVIEW_START = "09:00";

export const APPOINTMENT_TYPE_FIELD_LABELS = {
  label: "Libellé",
  color: "Couleur",
  defaultDurationMinutes: "Durée par défaut (minutes)",
  preview: "Aperçu dans l’agenda",
} as const;

export const APPOINTMENT_TYPE_FIELD_PLACEHOLDERS = {
  label: "ex. Consultation, Chirurgie, Contrôle",
} as const;

/** Zod messages — rendered verbatim by <FieldError />. */
export const APPOINTMENT_TYPE_VALIDATION_MESSAGES = {
  labelRequired: "Le libellé est obligatoire",
  labelTooLong: `Le libellé ne doit pas dépasser ${APPOINTMENT_TYPE_LABEL_MAX} caractères`,
  colorInvalid: "Choisissez une couleur de la palette",
  durationInvalid: `La durée doit être un nombre entier de minutes, entre ${APPOINTMENT_TYPE_DURATION_MIN} et ${APPOINTMENT_TYPE_DURATION_MAX}`,
} as const;

/** `TRPCError` messages thrown by `appointmentTypes.*`. */
export const APPOINTMENT_TYPE_SERVER_ERRORS = {
  notFound: "Type de rendez-vous introuvable.",
  duplicateLabel: "Un type de rendez-vous porte déjà ce libellé.",
} as const;

export const APPOINTMENT_TYPE_STATUS_LABELS = {
  active: "Actif",
  inactive: "Inactif",
} as const;

export const APPOINTMENT_TYPE_COLUMN_HEADERS = {
  label: "Type",
  duration: "Durée",
  status: "Statut",
  actions: "Actions",
} as const;

export const APPOINTMENT_TYPE_COPY = {
  sectionTitle: "Types de rendez-vous",
  sectionDescription:
    "Les catégories qui colorent l’agenda et proposent une durée par défaut. Elles sont distinctes du catalogue d’actes, qui sert à la facturation.",
  add: "Ajouter",
  adminOnly: "Seul un administrateur peut modifier ces réglages.",
  actionsLabel: "Actions sur le type",

  newTitle: "Nouveau type de rendez-vous",
  newDescription:
    "Choisissez un libellé, une couleur et la durée proposée à la prise de rendez-vous.",
  editTitle: "Modifier le type de rendez-vous",
  editDescription:
    "Le changement s’applique aussi aux rendez-vous déjà planifiés avec ce type.",
  previewFallback: "Libellé",
  previewPatient: "Nom du patient",

  edit: "Modifier",
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Type de rendez-vous créé",
  updated: "Type de rendez-vous mis à jour",
  deactivated:
    "Type désactivé : il n’est plus proposé pour les nouveaux rendez-vous",
  reactivated: "Type réactivé",

  emptyTitle: "Aucun type de rendez-vous pour le moment.",
  emptyDescription:
    "Créez des types pour colorer l’agenda et pré-remplir la durée des rendez-vous.",
  loadingTitle: "Chargement des types de rendez-vous",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des types de rendez-vous n’a pas pu être chargée. Veuillez réessayer.",
} as const;

/** 30 → «30 min», 60 → «1 h», 90 → «1 h 30». */
export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
};
