/**
 * Every French string the tasks slice renders or returns. The slice has no
 * pgEnum, so there is no label map — only copy.
 */

/** The most characters a task holds — schema, form counter and DB CHECK agree. */
export const TASK_CONTENT_MAX = 280;

/** Done tasks older than this many clinic days are not returned. */
export const DONE_WINDOW_DAYS = 30;

/** The most done tasks `getMany` returns, whatever the window holds. */
export const DONE_LIMIT = 100;

export const TASK_VALIDATION_MESSAGES = {
  contentRequired: "Saisissez le texte de la tâche.",
  contentTooLong: `La tâche ne peut pas dépasser ${TASK_CONTENT_MAX} caractères.`,
  dueDateInvalid: "Choisissez une date d’échéance valide.",
} as const;

export const TASK_SERVER_ERRORS = {
  notFound: "Tâche introuvable. Elle a peut-être été supprimée.",
  removeForbidden:
    "Seul l’auteur de la tâche ou l’administrateur du cabinet peut la supprimer.",
  /** Optimistic concurrency — the same family as the appointments' message. */
  taskChangedMeanwhile:
    "Cette tâche a été modifiée entre-temps. Rechargez-la avant de réessayer.",
} as const;

export const TASK_COPY = {
  pageTitle: "Liste des tâches",

  // Add bar
  contentLabel: "Nouvelle tâche",
  contentPlaceholder: "Ajouter une tâche…",
  add: "Ajouter",
  adding: "Ajout…",
  created: "Tâche ajoutée",

  // Importance and due date — shared by the bar, the rows and the form
  markImportant: "Marquer comme importante",
  unmarkImportant: "Retirer l’importance",
  important: "Importante",
  dueDateLabel: "Échéance",
  dueDatePlaceholder: "Sans échéance",
  clearDueDate: "Retirer l’échéance",

  // Lists
  openTitle: "Tâches non accomplies",
  doneTitle: "Tâches accomplies",
  openEmpty: "Aucune tâche en cours. Profitez-en !",
  doneEmpty: "Aucune tâche terminée.",
  doneWindowNote: `Les tâches terminées depuis plus de ${DONE_WINDOW_DAYS} jours sont masquées.`,
  markDone: "Marquer comme accomplie",
  markOpen: "Marquer comme non accomplie",
  createdBy: (name: string) => `Ajoutée par ${name}`,

  // Badges
  today: "Aujourd’hui",
  overdue: (day: string) => `En retard · ${day}`,

  // Row menu
  actionsLabel: "Actions de la tâche",
  edit: "Modifier",
  remove: "Supprimer",
  removeTitle: "Supprimer cette tâche ?",
  removeDescription:
    "La tâche sera définitivement supprimée pour toute l’équipe. Cette action est irréversible.",
  removed: "Tâche supprimée",
  updated: "Tâche mise à jour",

  // Edit dialog
  editTitle: "Modifier la tâche",
  editDescription: "Le texte, l’échéance et l’importance de la tâche.",
  contentFieldLabel: "Tâche",
  importanceFieldLabel: "Importance",
  cancel: "Annuler",
  save: "Mettre à jour",
  saving: "Mise à jour…",

  // States
  loadingTitle: "Chargement des tâches",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription: "Les tâches n’ont pas pu être chargées. Veuillez réessayer.",
} as const;
