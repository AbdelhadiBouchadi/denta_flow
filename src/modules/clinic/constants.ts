import { ASSET_REJECTION_MESSAGES } from "@/constants";

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
