import type { StatusTone } from "@/components/shared/status-badge";
import { StaffRole } from "./types";

/**
 * The only place French copy exists for this slice (06-ui.md §10). Every
 * message below reaches a user verbatim — a label, a Zod message, a
 * `TRPCError` or a toast — so review it as copy, not as debug text.
 */

export const STAFF_ROLE_LABELS: Record<`${StaffRole}`, string> = {
  [StaffRole.Admin]: "Administrateur",
  [StaffRole.Dentist]: "Dentiste",
  [StaffRole.Assistant]: "Assistant(e)",
  [StaffRole.Secretary]: "Secrétaire",
};

export const STAFF_ROLE_TONES: Record<`${StaffRole}`, StatusTone> = {
  [StaffRole.Admin]: "brand",
  [StaffRole.Dentist]: "info",
  [StaffRole.Assistant]: "neutral",
  [StaffRole.Secretary]: "neutral",
};

export const STAFF_ROLE_OPTIONS = Object.entries(STAFF_ROLE_LABELS).map(
  ([value, label]) => ({ value: value as StaffRole, label }),
);

/** The role a new account gets when the form does not say otherwise. */
export const DEFAULT_STAFF_ROLE = StaffRole.Assistant;

export const STAFF_STATUS_LABELS = {
  active: "Actif",
  inactive: "Inactif",
} as const;

export const STAFF_FIELD_LABELS = {
  name: "Nom complet",
  email: "Adresse e-mail",
  role: "Rôle",
  title: "Titre",
  inpe: "INPE",
  color: "Couleur",
} as const;

export const STAFF_FIELD_PLACEHOLDERS = {
  name: "ex. Dr Amina Benali",
  email: "prenom.nom@cabinet.ma",
  title: "ex. Chirurgien-dentiste",
  inpe: "ex. 123456789",
} as const;

/** Zod messages — rendered verbatim by <FieldError />. */
export const STAFF_VALIDATION_MESSAGES = {
  nameRequired: "Le nom est obligatoire",
  nameTooLong: "Le nom est trop long",
  emailRequired: "L’adresse e-mail est obligatoire",
  emailInvalid: "Adresse e-mail invalide",
  titleTooLong: "Le titre est trop long",
  inpeTooLong: "L’INPE est trop long",
  colorInvalid: "Choisissez une couleur",
} as const;

/** `TRPCError` messages thrown by `staff.*`. */
export const STAFF_SERVER_ERRORS = {
  notFound: "Utilisateur introuvable.",
  duplicateEmail: "Un utilisateur existe déjà avec cette adresse e-mail.",
  selfDemote: "Vous ne pouvez pas retirer votre propre rôle d’administrateur.",
  selfDeactivate: "Vous ne pouvez pas désactiver votre propre compte.",
  lastAdminDemote:
    "Impossible de changer le rôle du dernier administrateur actif. Nommez d’abord un autre administrateur.",
  lastAdminDeactivate:
    "Impossible de désactiver le dernier administrateur actif. Nommez d’abord un autre administrateur.",
  createFailed: "La création du compte a échoué. Veuillez réessayer.",
} as const;

export const STAFF_COPY = {
  sectionTitle: "Utilisateurs",
  sectionDescription:
    "Les membres du cabinet qui ont accès à DentaFlow et leur rôle.",
  add: "Ajouter un utilisateur",
  adminOnly: "Seul un administrateur peut gérer les utilisateurs.",
  actionsLabel: "Actions sur l’utilisateur",

  newTitle: "Nouvel utilisateur",
  newDescription:
    "Créez un accès au cabinet. Un mot de passe temporaire sera généré.",
  editTitle: "Modifier l’utilisateur",
  editDescription: "Mettez à jour le nom, le titre, l’INPE et la couleur.",
  roleTitle: "Changer le rôle",
  roleDescription: "Le nouveau rôle s’applique dès la prochaine action.",
  passwordNotice:
    "Aucun e-mail n’est envoyé : un mot de passe temporaire s’affichera une seule fois, à transmettre à la personne.",

  edit: "Modifier",
  changeRole: "Changer le rôle",
  resetPassword: "Réinitialiser le mot de passe",
  deactivate: "Désactiver",
  reactivate: "Réactiver",

  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Utilisateur créé",
  updated: "Utilisateur mis à jour",
  roleUpdated: "Rôle mis à jour",
  deactivated: "Utilisateur désactivé",
  reactivated: "Utilisateur réactivé",
  passwordReset: "Mot de passe réinitialisé",

  deactivateConfirmTitle: "Désactiver cet utilisateur ?",
  deactivateConfirmDescription:
    "La personne est déconnectée immédiatement et ne peut plus se connecter. Rien n’est supprimé : ses rendez-vous, actes et documents restent attribués à son nom, et vous pouvez la réactiver à tout moment.",
  resetConfirmTitle: "Réinitialiser le mot de passe ?",
  resetConfirmDescription:
    "L’ancien mot de passe cesse de fonctionner et les sessions ouvertes avec ce compte sont fermées. Un nouveau mot de passe temporaire s’affichera une seule fois.",

  passwordDialogTitle: "Mot de passe temporaire",
  passwordDialogDescription: "Transmettez-le à la personne concernée.",
  passwordFor: "Compte",
  passwordWarning: "Ce mot de passe ne sera plus affiché.",
  copy: "Copier",
  copied: "Mot de passe copié",
  copyFailed: "La copie a échoué. Sélectionnez le mot de passe et copiez-le.",
  close: "J’ai noté le mot de passe",

  emptyTitle: "Aucun utilisateur",
  emptyDescription: "Ajoutez les membres du cabinet pour leur donner un accès.",
  loadingTitle: "Chargement des utilisateurs",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des utilisateurs n’a pas pu être chargée. Veuillez réessayer.",
} as const;

export const STAFF_COLUMN_HEADERS = {
  name: "Nom",
  role: "Rôle",
  title: "Titre",
  inpe: "INPE",
  status: "Statut",
  actions: "Actions",
} as const;

/** The dash that stands in for a field the clinic has not recorded yet. */
export const EMPTY_FIELD = "—";
