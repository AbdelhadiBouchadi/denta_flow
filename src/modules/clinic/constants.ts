import { ASSET_REJECTION_MESSAGES } from "@/constants";

/**
 * The only place French copy exists for this slice (06-ui.md §10). Every
 * message below reaches a user verbatim — a field label, a Zod message, a
 * `TRPCError` or a toast — so review it as copy, not as debug text.
 */

/**
 * The French copy `clinic.uploadAsset` returns. Every message is rendered
 * verbatim in a toast — review it as copy (06-ui.md §10). The size and format
 * messages are the dropzone's own, so client and server read the same.
 */
export const CLINIC_ASSET_ERRORS = {
  tooLarge: ASSET_REJECTION_MESSAGES.tooLarge,
  unsupportedType: ASSET_REJECTION_MESSAGES.unsupportedType,
  contentMismatch:
    "Le contenu du fichier ne correspond pas à une image PNG, JPG ou WebP.",
  missingFile: "Aucune image n’a été reçue.",
  invalidKind: "Type d’image inconnu.",
  uploadFailed: "L’envoi de l’image a échoué. Veuillez réessayer.",
} as const;

/** Labels exactly as they read on Moroccan paperwork. */
export const CLINIC_FIELD_LABELS = {
  name: "Nom du cabinet",
  address: "Adresse",
  city: "Ville",
  phone: "Téléphone",
  email: "E-mail",
  ice: "ICE",
  patente: "Patente",
  fiscalId: "IF",
  cnssNumber: "CNSS",
  inpe: "INPE",
  logoUrl: "Logo du cabinet",
  letterheadUrl: "En-tête des documents",
} as const;

export const CLINIC_FIELD_PLACEHOLDERS = {
  name: "ex. Cabinet Dentaire Dr Amrani",
  address: "ex. Avenue Hassan II, n° 14",
  city: "ex. Agadir",
  phone: "ex. 05 28 84 32 17",
  email: "ex. contact@cabinet.ma",
  ice: "ex. 002184736000057",
  patente: "ex. 48213675",
  fiscalId: "ex. 40218756",
  cnssNumber: "ex. 7392146",
  inpe: "ex. 093412587",
} as const;

export const CLINIC_ASSET_HINTS = {
  logo: "Affiché dans la barre latérale et sur les documents.",
  letterhead: "Format A5 portrait — les documents imprimés s’y superposent.",
} as const;

export const CLINIC_VALIDATION_MESSAGES = {
  nameRequired: "Le nom du cabinet est obligatoire",
  nameTooLong: "Le nom du cabinet est trop long",
  addressTooLong: "L’adresse est trop longue",
  cityTooLong: "La ville est trop longue",
  phoneTooLong: "Le numéro de téléphone est trop long",
  invalidEmail: "Adresse e-mail invalide",
  foreignAsset: "Cette image ne provient pas du stockage du cabinet.",
} as const;

export const CLINIC_SERVER_ERRORS = {
  notFound: "Les paramètres du cabinet sont introuvables.",
} as const;

export const CLINIC_SETTINGS_COPY = {
  pageTitle: "Paramètres",
  sectionsNav: "Sections des paramètres",
  generalSection: "Général",
  saveReminder: "N’oubliez pas d’enregistrer après les changements",
  adminOnly: "Seul un administrateur peut modifier ces informations.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  reset: "Réinitialiser",
  saved: "Paramètres enregistrés",
  loadingTitle: "Chargement des paramètres",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Paramètres indisponibles",
  errorDescription:
    "Les informations du cabinet n’ont pas pu être chargées. Rechargez la page.",
} as const;
