import { StaffRole } from "@/modules/staff/types";

/**
 * FDI tooth numbering — the only accepted system (08-clinical.md §1). Two-digit
 * codes, quadrant first.
 *
 * Each quadrant is listed from the midline outwards (11 → 18), which is the
 * order a chart reads on the patient's right side of the screen.
 */
const quadrant = (q: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${q}${i + 1}`) as ToothCode[];

export const ADULT_TEETH: readonly ToothCode[] = [
  ...quadrant(1, 8),
  ...quadrant(2, 8),
  ...quadrant(3, 8),
  ...quadrant(4, 8),
];

export const CHILD_TEETH: readonly ToothCode[] = [
  ...quadrant(5, 5),
  ...quadrant(6, 5),
  ...quadrant(7, 5),
  ...quadrant(8, 5),
];

/**
 * Written out, not spread: `z.enum` needs a literal tuple, and a free
 * `z.string()` for a tooth is a bug (08-clinical.md §1).
 */
export const ALL_TEETH = [
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "51",
  "52",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "71",
  "72",
  "73",
  "74",
  "75",
  "81",
  "82",
  "83",
  "84",
  "85",
] as const;

export type ToothCode = (typeof ALL_TEETH)[number];

// ── The chart (prompts/28) ──────────────────────────────────────────────────

/**
 * The exact version of `react-advanced-odontogram` in package.json, written
 * into every saved envelope so a later upgrade can tell old charts apart.
 * A Vitest test keeps the two equal.
 */
export const ODONTOGRAM_LIBRARY_VERSION = "2.5.0";

/** Our envelope's own format — not the library's. */
export const ODONTOGRAM_ENVELOPE_VERSION = 1;

/** A library export is ~45 KB; anything near this cap is not a chart. */
export const ODONTOGRAM_MAX_BYTES = 512 * 1024;

/** The library nests about six levels; this only stops pathological input. */
export const ODONTOGRAM_MAX_DEPTH = 32;

/** Who may save the chart. A secretary reads it (prompts/28, decision 4). */
export const ODONTOGRAM_WRITER_ROLES: readonly StaffRole[] = [
  StaffRole.Admin,
  StaffRole.Dentist,
  StaffRole.Assistant,
];

/** Who may wipe it, situation initiale included. */
export const ODONTOGRAM_RESETTER_ROLES: readonly StaffRole[] = [
  StaffRole.Admin,
  StaffRole.Dentist,
];

export const ODONTOGRAM_VALIDATION_MESSAGES = {
  patientRequired: "Patient requis.",
  envelopeInvalid:
    "Le schéma dentaire envoyé est illisible. Rechargez la page avant de réessayer.",
  envelopeVersion:
    "Ce schéma dentaire vient d’une version inconnue de DentaFlow. Rechargez la page.",
  tooLarge: "Le schéma dentaire dépasse la taille autorisée (512 Ko).",
  tooDeep: "Le schéma dentaire envoyé est mal formé.",
} as const;

export const ODONTOGRAM_SERVER_ERRORS = {
  patientNotFound: "Patient introuvable. Il a peut-être été supprimé.",
  chartNotFound: "Ce patient n’a pas encore de schéma dentaire.",
  writeForbidden:
    "Votre rôle permet de consulter le schéma dentaire, pas de le modifier.",
  resetForbidden:
    "Seuls l’administrateur et les dentistes peuvent réinitialiser le schéma dentaire.",
  archived:
    "Ce dossier est archivé : son schéma dentaire est en lecture seule. Réactivez le patient pour le modifier.",
  changedMeanwhile:
    "Le schéma dentaire a été modifié entre-temps par un autre utilisateur. Rechargez-le avant d’enregistrer.",
} as const;

export const ODONTOGRAM_COPY = {
  tabLabel: "Odontogramme",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "Odontogramme enregistré",
  unsaved: "Modifications non enregistrées",
  showInitial: "Voir la situation initiale",
  showCurrent: "Revenir à l’état actuel",
  initialBanner:
    "Situation initiale — le schéma tel qu’enregistré la première fois. Lecture seule.",
  readOnlyRole:
    "Lecture seule : votre rôle ne permet pas de modifier le schéma.",
  readOnlyArchived:
    "Lecture seule : ce dossier est archivé. Réactivez le patient pour modifier le schéma.",
  emptyHint:
    "Aucun schéma enregistré : partez de cette bouche saine, puis « Enregistrer ». Le premier enregistrement devient la situation initiale.",
  moreActions: "Autres actions",
  resetTitle: "Réinitialiser le schéma dentaire ?",
  resetDescription:
    "Le schéma actuel ET la situation initiale seront effacés définitivement. Les actes du patient ne sont pas modifiés.",
  resetDone: "Schéma dentaire réinitialisé",
  createActe: "Créer un acte",
  createActeHint: "Sélectionnez une ou plusieurs dents sur le schéma.",
  selectedTeeth: (count: number) =>
    count === 0
      ? "Aucune dent sélectionnée"
      : `${count} dent${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`,
  reload: "Recharger",
  changedElsewhere:
    "Ce schéma dentaire a été modifié par un autre utilisateur depuis son ouverture. « Recharger » affiche sa version — vos modifications non enregistrées seront perdues.",
  retry: "Réessayer",
  leaveTitle: "Quitter sans enregistrer ?",
  leaveDescription:
    "Les modifications du schéma dentaire non enregistrées seront perdues.",
  leaveConfirm: "Quitter",
  discardTitle: "Abandonner les modifications ?",
  loadErrorTitle: "Schéma dentaire illisible",
  loadErrorDescription:
    "Le schéma enregistré pour ce patient n’a pas pu être affiché. Il est peut-être corrompu ou incompatible.",
  loadErrorResetHint:
    "Un administrateur ou un dentiste peut réinitialiser le schéma pour repartir d’une bouche saine.",
  resetChart: "Réinitialiser le schéma",
  errorTitle: "Odontogramme indisponible",
  errorDescription: "Le schéma dentaire n’a pas pu être chargé.",
  loading: "Chargement du schéma dentaire…",
} as const;
