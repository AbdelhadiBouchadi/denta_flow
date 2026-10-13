import type { StatusTone } from "@/components/shared/status-badge";
import { StaffRole } from "@/modules/staff/types";
import { ImageContentType, ImagingGroupBy, PatientFileKind } from "./types";

/**
 * The only place French UI copy for this slice exists (06-ui.md §10), and
 * the slice's limits. Free of `server-only`: the browser validates with the
 * same numbers the upload route and `register` enforce.
 */

// ── Who may do what (prompts/31, decision 3) ────────────────────────────────

/**
 * Read, upload and edit metadata. ONE constant: changing the rule is a
 * one-line change here. The secretary is deliberately absent. Removal is an
 * `adminProcedure` on top of this.
 */
export const IMAGING_ROLES: readonly StaffRole[] = [
  StaffRole.Admin,
  StaffRole.Dentist,
  StaffRole.Assistant,
];

// ── Kinds ───────────────────────────────────────────────────────────────────

export const PATIENT_FILE_KIND_LABELS: Record<PatientFileKind, string> = {
  [PatientFileKind.Panoramic]: "Panoramique",
  [PatientFileKind.Periapical]: "Rétro-alvéolaire",
  [PatientFileKind.Cephalometric]: "Téléradiographie",
  [PatientFileKind.Photo]: "Photo",
  [PatientFileKind.Other]: "Autre",
};

/** Radiographs read as one family, photos as another (06-ui.md §4 palette). */
export const PATIENT_FILE_KIND_TONES: Record<PatientFileKind, StatusTone> = {
  [PatientFileKind.Panoramic]: "info",
  [PatientFileKind.Periapical]: "info",
  [PatientFileKind.Cephalometric]: "info",
  [PatientFileKind.Photo]: "brand",
  [PatientFileKind.Other]: "neutral",
};

/** The literal tuple nuqs and zod accept, in the label map's order. */
export const PATIENT_FILE_KIND_VALUES = [
  PatientFileKind.Panoramic,
  PatientFileKind.Periapical,
  PatientFileKind.Cephalometric,
  PatientFileKind.Photo,
  PatientFileKind.Other,
] as const;

export const PATIENT_FILE_KIND_OPTIONS = PATIENT_FILE_KIND_VALUES.map(
  (value) => ({ value, label: PATIENT_FILE_KIND_LABELS[value] }),
);

/**
 * The fixed order of the «Par type» groups, of the kinds inside a «Par date»
 * group and of the chips (prompts/32, decision 2). Radiographs first, from
 * the widest view to the narrowest, then photos.
 */
export const PATIENT_FILE_KIND_ORDER: readonly PatientFileKind[] =
  PATIENT_FILE_KIND_VALUES;

/** Plural labels: the «Par type» group headers and the filter chips. */
export const PATIENT_FILE_KIND_GROUP_LABELS: Record<PatientFileKind, string> = {
  [PatientFileKind.Panoramic]: "Panoramiques",
  [PatientFileKind.Periapical]: "Rétro-alvéolaires",
  [PatientFileKind.Cephalometric]: "Téléradiographies",
  [PatientFileKind.Photo]: "Photos",
  [PatientFileKind.Other]: "Autres",
};

// ── Grouping (prompts/32, decision 2) ───────────────────────────────────────

export const IMAGING_GROUP_BY_VALUES = [
  ImagingGroupBy.Date,
  ImagingGroupBy.Type,
] as const;

export const DEFAULT_IMAGING_GROUP_BY = ImagingGroupBy.Date;

export const IMAGING_GROUP_BY_LABELS: Record<ImagingGroupBy, string> = {
  [ImagingGroupBy.Date]: "Par date",
  [ImagingGroupBy.Type]: "Par type",
};

// ── Allowed content (decision 5) ────────────────────────────────────────────

export const IMAGE_CONTENT_TYPES = [
  ImageContentType.Jpeg,
  ImageContentType.Png,
  ImageContentType.Webp,
] as const;

/** The extension a stored pathname carries for each type. */
export const IMAGE_EXTENSIONS: Record<ImageContentType, string> = {
  [ImageContentType.Jpeg]: "jpg",
  [ImageContentType.Png]: "png",
  [ImageContentType.Webp]: "webp",
};

/** What the file picker offers; the validator is the authority. */
export const IMAGE_ACCEPT = IMAGE_CONTENT_TYPES.join(",");

export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_MIN_DIMENSION = 64;
export const IMAGE_MAX_DIMENSION = 12_000;

/** Thumbnails (decision 8): made in the browser, JPEG, long side ≤ 480 px. */
export const THUMBNAIL_LONG_SIDE = 480;
export const THUMBNAIL_QUALITY = 0.8;
export const THUMBNAIL_CONTENT_TYPE = ImageContentType.Jpeg;
/** A 480 px JPEG is tens of KB; anything near this cap is not a thumbnail. */
export const THUMBNAIL_MAX_BYTES = 1024 * 1024;

export const MAX_FILES_PER_BATCH = 10;
/** Concurrent uploads in one batch — a clinic's uplink, not a datacentre's. */
export const UPLOAD_CONCURRENCY = 3;
/** `getManyByPatient` returns at most this many rows. */
export const IMAGING_LIST_CAP = 200;
/** A full adult dentition: no image can show more distinct teeth. */
export const IMAGING_MAX_TEETH = 32;
/** Tooth chips on a tile before «+N». */
export const IMAGING_TILE_MAX_TEETH = 3;
/** «Comparer» puts exactly two images side by side. */
export const IMAGING_COMPARE_MAX = 2;
export const IMAGING_NOTES_MAX = 1000;
export const ORIGINAL_NAME_MAX = 255;
/** A signed upload token outlives a slow phone upload, not much more. */
export const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

// ── Paths ───────────────────────────────────────────────────────────────────

/** The app path the browser reads a file from — never a blob URL. */
export const imagingFileUrl = (
  id: string,
  variant?: "thumb" | "download",
) =>
  variant === "thumb"
    ? `/api/files/${id}?thumb=1`
    : variant === "download"
      ? `/api/files/${id}?download=1`
      : `/api/files/${id}`;

export const IMAGING_UPLOAD_ROUTE = "/api/files/upload";

// ── Copy ────────────────────────────────────────────────────────────────────

export const IMAGING_COPY = {
  tabLabel: "Imagerie",
  addImages: "Ajouter des images",
  allKinds: "Toutes",
  filterLabel: "Filtrer par type d’image",
  count: (count: number) =>
    count === 0 ? "Aucune image" : `${count} image${count > 1 ? "s" : ""}`,
  /** «Panoramiques (3)», «Toutes (12)». */
  chip: (label: string, count: number) => `${label} (${count})`,
  truncated: `Seules les ${IMAGING_LIST_CAP} images les plus récentes sont affichées.`,
  emptyTitle: "Aucune image pour le moment.",
  emptyDescription:
    "Les radiographies et photos ajoutées au dossier apparaîtront ici.",
  emptyFilteredTitle: "Aucune image ne correspond.",
  emptyFilteredDescription: "Modifiez le type ou la dent sélectionnés.",
  resetFilters: "Réinitialiser les filtres",

  // Toolbar (prompts/32)
  groupByLabel: "Regrouper les images",
  toothFilter: "Dent",
  toothFilterLabel: "Filtrer par dent",
  toothFilterHint: "Seules les images étiquetées avec cette dent sont affichées.",
  toothChip: (tooth: string) => `Dent ${tooth}`,
  clearTooth: (tooth: string) => `Retirer le filtre Dent ${tooth}`,
  compare: "Comparer",
  compareCancel: "Annuler la comparaison",
  compareHint: "Sélectionnez deux images à comparer.",
  compareSelected: (count: number) => `${count} / ${IMAGING_COMPARE_MAX} sélectionnée${count > 1 ? "s" : ""}`,
  compareTooMany: "Deux images au plus : désélectionnez-en une d’abord.",
  selectTile: (label: string) => `Sélectionner ${label}`,
  groupToggle: (label: string, count: number) =>
    `${label}, ${count} image${count > 1 ? "s" : ""}`,
  groupCount: (count: number) => `${count} image${count > 1 ? "s" : ""}`,
  today: "Aujourd’hui",
  yesterday: "Hier",
  moreTeeth: (count: number) => `+${count}`,
  teeth: "Dents",
  noTeeth: "Aucune dent",

  // Compare view
  compareTitle: "Comparaison d’images",
  compareDescription: "Deux images côte à côte, chacune avec son propre zoom.",
  syncZoom: "Synchroniser le zoom",
  archivedNotice:
    "Dossier archivé : les images restent consultables mais ne peuvent plus être modifiées.",
  forbiddenTitle: "Accès réservé",
  forbiddenDescription:
    "L’imagerie est réservée aux praticiens et aux assistants.",
  notConfiguredTitle: "Stockage non configuré",
  notConfiguredDescription:
    "Le stockage privé des images n’est pas encore configuré pour ce cabinet. Le reste du dossier reste disponible.",
  errorTitle: "Images indisponibles",
  errorDescription: "Les images de ce dossier n’ont pas pu être chargées.",
  retry: "Réessayer",
  noThumbnail: "Aperçu indisponible",
  tileLabel: (kind: string, date: string) => `${kind} du ${date}`,

  // Upload dialog
  uploadTitle: "Ajouter des images",
  uploadDescription:
    "JPEG, PNG ou WebP, 25 Mo au plus par image, 10 images par envoi.",
  dropZone: "Déposez vos images ici ou cliquez pour les choisir",
  dropZoneHint: "Radiographies et photos, envoyées telles quelles.",
  takePhoto: "Prendre une photo",
  removeFile: "Retirer",
  kind: "Type",
  takenDate: "Date",
  notes: "Note",
  notesPlaceholder: "Facultatif",
  pickDate: "Choisir une date",
  send: (count: number) =>
    count > 1 ? `Envoyer ${count} images` : "Envoyer l’image",
  sending: "Envoi…",
  cancel: "Annuler",
  close: "Fermer",
  tooMany: `10 images au plus par envoi : les suivantes n’ont pas été ajoutées.`,
  statusQueued: "Prête",
  statusUploading: "Envoi…",
  statusDone: "Envoyée",
  uploaded: (count: number) =>
    count > 1 ? `${count} images ajoutées au dossier` : "Image ajoutée au dossier",
  exifNotice:
    "Les photos de téléphone peuvent contenir leur position GPS : l’original est conservé tel quel.",

  // Viewer
  viewerTitle: "Visionneuse d’images",
  filmstrip: "Images du groupe",
  filmstripItem: (label: string, index: number, total: number) =>
    `${label} (${index} / ${total})`,
  previous: "Image précédente",
  next: "Image suivante",
  position: (index: number, total: number) => `${index} / ${total}`,
  zoomIn: "Agrandir",
  zoomOut: "Réduire",
  reset: "Réinitialiser l’affichage",
  brightness: "Luminosité",
  contrast: "Contraste",
  invert: "Inversion",
  rotate: "Pivoter de 90°",
  adjustments: "Réglages d’affichage",
  adjustmentsNote: "Réglages d’affichage uniquement : l’original n’est jamais modifié.",
  details: "Détails",
  hideDetails: "Masquer les détails",
  uploadedBy: "Ajoutée par",
  unknownStaff: "Utilisateur supprimé",
  dimensions: "Dimensions",
  dimensionsValue: (width: number, height: number) => `${width} × ${height} px`,
  size: "Taille",
  file: "Fichier",
  addedOn: "Ajoutée le",
  noNotes: "Aucune note",
  download: "Télécharger l’original",
  edit: "Modifier",
  save: "Enregistrer",
  saving: "Enregistrement…",
  updated: "Image mise à jour",
  remove: "Supprimer",
  removeTitle: "Supprimer cette image ?",
  removeDescription:
    "L’image sera masquée du dossier du patient. Le fichier original est conservé et l’action est enregistrée dans l’activité du jour.",
  removed: "Image supprimée du dossier",
  moreActions: "Plus d’actions",
  loadingImage: "Chargement de l’image…",
  imageFailed: "L’image n’a pas pu être affichée.",
} as const;

/** Every message a user can read from validation. Rendered verbatim. */
export const IMAGING_VALIDATION_MESSAGES = {
  patientRequired: "Patient requis",
  idRequired: "Identifiant requis",
  kindInvalid: "Type d’image invalide",
  dateInvalid: "Date invalide",
  inFuture: "La date ne peut pas être dans le futur",
  teethInvalid: "Liste de dents invalide",
  teethDuplicate: "Une même dent ne peut être indiquée qu’une fois",
  teethTooMany: `${IMAGING_MAX_TEETH} dents au plus par image`,
  notesTooLong: `La note ne peut pas dépasser ${IMAGING_NOTES_MAX} caractères`,
  nameInvalid: "Nom de fichier invalide",
  pathnameInvalid: "Chemin de fichier invalide",
  sizeInvalid: "Taille de fichier invalide",
  heic: "Format HEIC non pris en charge : exportez la photo en JPEG depuis le téléphone, puis réessayez.",
  dicom: "Les fichiers DICOM ne sont pas encore pris en charge : exportez l’image en JPEG ou PNG.",
  typeNotAllowed: "Format non pris en charge : JPEG, PNG ou WebP uniquement.",
  tooLarge: "Image trop volumineuse : 25 Mo au plus.",
  empty: "Ce fichier est vide.",
  tooSmall: `Image trop petite : ${IMAGE_MIN_DIMENSION} px au moins de chaque côté.`,
  tooBig: `Image trop grande : ${IMAGE_MAX_DIMENSION.toLocaleString("fr-FR")} px au plus de chaque côté.`,
  unreadable: "Cette image n’a pas pu être lue. Le fichier est peut-être endommagé.",
} as const;

/**
 * What `update` appends to the activity line when the teeth change
 * (prompts/32): the line itself comes from the activity slice's summaries.
 */
export const IMAGING_ACTIVITY_COPY = {
  teethChanged: (teeth: readonly string[]) =>
    teeth.length === 0 ? " Dents retirées." : ` Dents : ${teeth.join(", ")}.`,
} as const;

/** Every message a procedure or a route can answer with. */
export const IMAGING_SERVER_ERRORS = {
  forbidden: "L’imagerie est réservée aux praticiens et aux assistants.",
  archived:
    "Ce dossier est archivé : ses images ne peuvent plus être modifiées. Réactivez le patient pour en ajouter.",
  removeForbidden: "Action réservée à l’administrateur du cabinet.",
  patientNotFound: "Patient introuvable.",
  fileNotFound: "Image introuvable. Elle a peut-être été supprimée.",
  changedMeanwhile:
    "Cette image a été modifiée entre-temps. Les dernières informations ont été rechargées.",
  pathnameForeign: "Ce fichier n’appartient pas au dossier de ce patient.",
  pathnameUsed: "Ce fichier est déjà enregistré dans un dossier.",
  blobMissing: "Le fichier envoyé est introuvable. Merci de recommencer l’envoi.",
  sizeMismatch: "La taille du fichier envoyé ne correspond pas. Merci de recommencer l’envoi.",
  typeMismatch: "Le format du fichier envoyé ne correspond pas. Merci de recommencer l’envoi.",
  thumbnailInvalid: "La miniature envoyée est invalide. Merci de recommencer l’envoi.",
  uploadFailed: "L’envoi de l’image a échoué. Vérifiez la connexion et réessayez.",
  uploadRejected: "Le serveur a refusé cet envoi.",
  invalidRequest: "Requête d’envoi invalide.",
} as const;
