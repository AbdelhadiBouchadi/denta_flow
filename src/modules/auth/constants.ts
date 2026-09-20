/**
 * Better Auth's own default for `emailAndPassword.minPasswordLength`.
 * Mirrored here so the Zod schema and the server agree: a form that accepts a
 * 6-character password only to have the API reject it is a bug the user pays for.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Where a successful sign-in or sign-up lands. */
export const AUTH_SUCCESS_REDIRECT = "/tableau-de-bord";

/**
 * Better Auth answers with an English `message` and a stable `code`.
 * The code is the contract; the message is debug text. Only the French copy
 * below is ever rendered (AGENTS.md §5, 06-ui.md §10).
 *
 * Keys are Better Auth's `BASE_ERROR_CODES` plus the sign-up route's own code.
 * An unmapped code falls back to DEFAULT_AUTH_ERROR_MESSAGE rather than leaking
 * English into the UI.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // --- Sign-in ---
  // Wrong password, unknown address and disabled credentials collapse to one
  // message on purpose: telling an attacker which half was wrong enumerates
  // the clinic's staff addresses.
  INVALID_EMAIL_OR_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
  INVALID_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
  USER_NOT_FOUND: "Adresse e-mail ou mot de passe incorrect.",
  INVALID_EMAIL: "Adresse e-mail invalide.",
  CREDENTIAL_ACCOUNT_NOT_FOUND:
    "Ce compte n’a pas de mot de passe. Contactez l’administrateur du cabinet.",
  EMAIL_NOT_VERIFIED: "Cette adresse e-mail n’a pas encore été vérifiée.",
  // The session hook in src/lib/auth.ts refuses to open a session for a staff
  // member whose `isActive` is false; Better Auth surfaces that as this code.
  FAILED_TO_CREATE_SESSION:
    "Ce compte a été désactivé. Contactez l’administrateur du cabinet.",
  SESSION_EXPIRED: "Session expirée. Veuillez vous reconnecter.",

  // --- Sign-up ---
  EMAIL_PASSWORD_SIGN_UP_DISABLED:
    "La création de compte est désactivée. Demandez à l’administrateur du cabinet de vous créer un accès.",
  USER_ALREADY_EXISTS: "Un compte existe déjà pour cette adresse e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Un compte existe déjà pour cette adresse e-mail.",
  PASSWORD_TOO_SHORT: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  FAILED_TO_CREATE_USER: "La création du compte a échoué. Veuillez réessayer.",

  // --- Request-level refusals ---
  VALIDATION_ERROR: "Certains champs sont invalides. Vérifiez votre saisie.",
  MISSING_FIELD: "Certains champs sont invalides. Vérifiez votre saisie.",
  INVALID_ORIGIN:
    "Requête refusée pour des raisons de sécurité. Rechargez la page et réessayez.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "Requête refusée pour des raisons de sécurité. Rechargez la page et réessayez.",
};

export const DEFAULT_AUTH_ERROR_MESSAGE =
  "Une erreur est survenue. Veuillez réessayer.";

export const NETWORK_AUTH_ERROR_MESSAGE =
  "Connexion au serveur impossible. Vérifiez votre connexion internet.";
