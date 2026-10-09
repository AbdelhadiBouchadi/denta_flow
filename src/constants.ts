export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

export const CLINIC_TIMEZONE = "Africa/Casablanca";
export const CURRENCY_SUFFIX = "DH";

export const WEEK_STARTS_ON = 1; // lundi (ISO)
export const AGENDA_SLOT_MINUTES = 15;
export const AGENDA_DAY_START = "08:00";
export const AGENDA_DAY_END = "20:00";

/**
 * The staff roles that see patients — the one definition of «practitioner»
 * (prompts/15-types-rdv-horaires.md). A single-owner clinic's admin is
 * usually the dentist. A practitioner is an ACTIVE staff member with one of
 * these roles; schedules, leave and the agenda filter all import this.
 */
export const PRACTITIONER_ROLES = ["dentist", "admin"] as const;

// ── Uploaded clinic assets (logo, letterhead) ───────────────────────────────
// One source for the dropzone and the procedure: the client validates against
// these for fast feedback, the server re-validates against the same values.

/** 4 Mo — under Vercel's 4,5 Mo request-body limit for a function upload. */
export const ASSET_MAX_BYTES = 4 * 1024 * 1024;

/** SVG is excluded on purpose: it can carry script. */
export const ASSET_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AssetMimeType = (typeof ASSET_ACCEPTED_MIME_TYPES)[number];

/** What the native file picker filters on, per accepted MIME type. */
export const ASSET_FILE_EXTENSIONS: Record<AssetMimeType, readonly string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

/** Shown by the dropzone and returned by the procedure — identical copy. */
export const ASSET_REJECTION_MESSAGES = {
  tooLarge: "Image trop lourde (4 Mo maximum).",
  unsupportedType: "Format non pris en charge. Utilisez PNG, JPG ou WebP.",
  tooMany: "Une seule image à la fois.",
} as const;

export const IMAGE_DROPZONE_COPY = {
  dropPrompt: "Glissez-déposez une image ou",
  browse: "parcourez",
  /** Replaces the two above on a touch screen, where nothing can be dropped. */
  tapPrompt: "Touchez pour choisir une image",
  dragActive: "Déposez l’image ici",
  formats: "PNG, JPG ou WebP · 4 Mo maximum",
  replace: "Remplacer",
  remove: "Retirer",
  unsaved: "Non enregistré",
  removalPending: "L’image sera retirée à l’enregistrement.",
} as const;

// ── User-facing error copy shared by every slice ────────────────────────────
export const ERROR_MESSAGES = {
  /** A procedure input rejected by its Zod schema. */
  invalidFields: "Certains champs sont invalides.",
  /** No server answer at all — offline, DNS, a dropped connection. */
  network: "Le serveur est injoignable. Vérifiez votre connexion et réessayez.",
} as const;
