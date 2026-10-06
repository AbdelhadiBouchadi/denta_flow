import type { ExceptionPeriod } from "./exceptions";

/**
 * The only place French copy exists for this slice (06-ui.md §10). Every
 * message below reaches a user verbatim — a label, a Zod message, a
 * `TRPCError` or a toast.
 */

// ── Rules ───────────────────────────────────────────────────────────────────

/** ISO weekdays, lundi first (`WEEK_STARTS_ON = 1`). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Morning + afternoon is the norm; three covers a split evening. */
export const SCHEDULE_MAX_RANGES_PER_DAY = 3;
/** Every start and end lands on a 5-minute mark — the TimeField's step. */
export const SCHEDULE_MINUTE_STEP = 5;
/** What «+ Ajouter une plage» proposes on an empty day. */
export const SCHEDULE_DEFAULT_RANGE = { startTime: "09:00", endTime: "13:00" };
/** …and after an existing range: the afternoon. */
export const SCHEDULE_AFTERNOON_RANGE = {
  startTime: "14:00",
  endTime: "18:00",
};
export const EXCEPTION_REASON_MAX = 200;

/**
 * «Unconfigured» — the contract branch 18 (the agenda) reads.
 *
 * A practitioner with NO weekly row has no hours configured. The agenda then
 * shows its default bounds (`AGENDA_DAY_START`–`AGENDA_DAY_END`) and raises
 * NO out-of-hours warning for them. It does NOT mean «closed all week»: a new
 * install, or a practitioner whose hours nobody entered yet, would otherwise
 * warn on every booking.
 *
 * Once a practitioner has at least one row, the week is configured, and an
 * empty day in it does mean «Fermé» — a booking there is warned, never
 * blocked. Exceptions (congés, fermetures) warn the same way and never block.
 */
export const isWeekConfigured = (
  days: readonly { ranges: readonly unknown[] }[],
) => days.some((day) => day.ranges.length > 0);

// ── Labels ──────────────────────────────────────────────────────────────────

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

/** Zod messages — rendered verbatim by <FieldError />. */
export const SCHEDULE_VALIDATION_MESSAGES = {
  practitionerRequired: "Choisissez un praticien",
  weekdayInvalid: "Le jour doit être compris entre lundi et dimanche",
  timeInvalid: "Heure invalide (format HH:mm attendu)",
  timeStep: `Les heures vont de ${SCHEDULE_MINUTE_STEP} en ${SCHEDULE_MINUTE_STEP} minutes`,
  endBeforeStart: "L’heure de fin doit être après l’heure de début",
  overlap: "Cette plage chevauche une autre plage du même jour",
  tooManyRanges: `${SCHEDULE_MAX_RANGES_PER_DAY} plages maximum par jour`,

  dateRequired: "Choisissez les dates",
  dateInvalid: "Date invalide",
  endDateBeforeStart: "La date de fin doit être après la date de début",
  timeRequired: "Indiquez l’heure",
  endsBeforeStarts: "La fin doit être après le début",
  reasonTooLong: `Le motif ne doit pas dépasser ${EXCEPTION_REASON_MAX} caractères`,
} as const;

/** `TRPCError` messages thrown by `schedules.*`. */
export const SCHEDULE_SERVER_ERRORS = {
  practitionerNotFound:
    "Praticien introuvable, désactivé ou sans rôle de praticien.",
  exceptionNotFound: "Fermeture introuvable.",
} as const;

export const SCHEDULE_COPY = {
  sectionTitle: "Horaires",
  sectionDescription:
    "Les heures d’ouverture de chaque praticien et les fermetures du cabinet. Elles bornent l’agenda et signalent un rendez-vous hors horaires, sans jamais l’empêcher.",
  adminOnly: "Seul un administrateur peut modifier les horaires.",
  loadingTitle: "Chargement des horaires",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "Les horaires n’ont pas pu être chargés. Veuillez réessayer.",
} as const;

export const WEEK_COPY = {
  title: "Heures d’ouverture",
  description:
    "Heure locale du cabinet, sur 24 heures. Deux plages par jour pour une pause déjeuner.",
  practitioner: "Praticien",
  noPractitionerTitle: "Aucun praticien actif.",
  noPractitionerDescription:
    "Les horaires se règlent par dentiste ou administrateur actif. Ajoutez-en un dans « Utilisateurs ».",
  unconfigured:
    "Aucun horaire saisi pour ce praticien : l’agenda n’affichera aucun avertissement hors horaires tant que la semaine est vide.",
  closed: "Fermé",
  start: "Début",
  end: "Fin",
  rangeSeparator: "–",
  addRange: "Ajouter une plage",
  removeRange: "Retirer la plage",
  copyTo: "Copier vers…",
  copyToTitle: "Copier les plages de ce jour vers :",
  copyApply: "Appliquer",
  copyDone: "Plages copiées — pensez à enregistrer",
  applyWeek: "Appliquer la semaine à…",
  applyWeekTitle: "Appliquer cette semaine à un autre praticien",
  applyWeekDescription:
    "Ses horaires actuels seront remplacés par la semaine affichée ici, modifications non enregistrées comprises.",
  applyWeekTarget: "Praticien cible",
  applyWeekConfirm: "Appliquer",
  applyWeekApplying: "Application…",
  applyWeekConfirmTitle: "Remplacer ses horaires ?",
  applyWeekNoTarget: "Aucun autre praticien actif.",
  applyWeekDone: "Semaine appliquée",
  save: "Enregistrer",
  saving: "Enregistrement…",
  reset: "Annuler les modifications",
  saved: "Horaires enregistrés",
  invalid: "Corrigez les plages signalées avant d’enregistrer.",
} as const;

/** The confirmation names what is lost: the target's current week. */
export const applyWeekConfirmDescription = (name: string) =>
  `Les horaires actuels de ${name} seront effacés et remplacés par cette semaine. Cette action ne touche pas ses rendez-vous.`;

/** «Lundi : Fermé», «Lundi : 2 plages» — for the copy popover's checkboxes. */
export const rangeCountLabel = (count: number) =>
  count === 0 ? WEEK_COPY.closed : `${count} plage${count >= 2 ? "s" : ""}`;

export const EXCEPTION_COPY = {
  title: "Congés et fermetures",
  description:
    "Jours fériés, vacances du cabinet, congé d’un praticien. L’agenda les signale ; une prise de rendez-vous reste possible.",
  add: "Ajouter une fermeture",
  showPast: "Afficher les passées",
  emptyTitle: "Aucune fermeture à venir.",
  emptyPastTitle: "Aucune fermeture enregistrée.",
  emptyDescription:
    "Ajoutez un jour férié, des vacances du cabinet ou le congé d’un praticien.",
  clinicWide: "Tout le cabinet",
  noReason: "—",
  past: "Passée",
  actionsLabel: "Actions sur la fermeture",
  edit: "Modifier",
  remove: "Supprimer",

  newTitle: "Nouvelle fermeture",
  newDescription:
    "Pour tout le cabinet ou un seul praticien, sur une ou plusieurs journées.",
  editTitle: "Modifier la fermeture",
  editDescription: "Les rendez-vous déjà pris ne sont pas modifiés.",
  scope: "Concerne",
  dates: "Dates",
  datesPlaceholder: "Choisir les dates",
  allDay: "Journées entières",
  allDayHint:
    "Décochez pour une fermeture partielle : l’heure de début vaut pour le premier jour, l’heure de fin pour le dernier.",
  startTime: "Heure de début",
  endTime: "Heure de fin",
  reason: "Motif",
  reasonPlaceholder: "ex. Aïd al-Fitr, congé annuel, formation",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Fermeture ajoutée",
  updated: "Fermeture mise à jour",
  removed: "Fermeture supprimée",
  removeConfirmTitle: "Supprimer cette fermeture ?",
} as const;

export const EXCEPTION_COLUMN_HEADERS = {
  period: "Dates",
  scope: "Concerne",
  reason: "Motif",
  actions: "Actions",
} as const;

/** The deletion is real (configuration, not history), so it says what goes. */
export const exceptionRemoveConfirmDescription = (period: string) =>
  `La fermeture « ${period} » sera supprimée définitivement. Les rendez-vous de cette période ne sont pas touchés.`;

/** "2026-10-12" → "12/10/2026". A calendar day, so no zone is involved. */
export const formatCalendarDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

/**
 * «Le 12/10/2026», «Du 12/10/2026 au 14/10/2026»,
 * «Le 12/10/2026, de 14:00 à 18:00», «Du 12/10/2026 à 14:00 au 14/10/2026 à 12:00».
 */
export const formatExceptionPeriod = (period: ExceptionPeriod) => {
  const start = formatCalendarDate(period.startDate);
  const end = formatCalendarDate(period.endDate);
  const sameDay = period.startDate === period.endDate;

  if (period.allDay) {
    return sameDay ? `Le ${start}` : `Du ${start} au ${end}`;
  }
  return sameDay
    ? `Le ${start}, de ${period.startTime} à ${period.endTime}`
    : `Du ${start} à ${period.startTime} au ${end} à ${period.endTime}`;
};
