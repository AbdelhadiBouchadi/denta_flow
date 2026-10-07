import type { StatusTone } from "@/components/shared/status-badge";
import { AppointmentStatus, BookingWarning, CalendarView } from "./types";

/**
 * The only place French copy for this slice exists. Never inline one of these
 * labels in a column def, a badge or a <SelectItem> (06-ui.md §10).
 */

// ── Status ──────────────────────────────────────────────────────────────────

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Planned]: "Planifié",
  [AppointmentStatus.Confirmed]: "Confirmé",
  [AppointmentStatus.Arrived]: "En salle d’attente",
  [AppointmentStatus.Completed]: "Terminé",
  [AppointmentStatus.Canceled]: "Annulé",
  [AppointmentStatus.NoShow]: "Absent",
};

/** The «Rendez-vous» badge family of 06-ui.md §4. */
export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  [AppointmentStatus.Planned]: "warning",
  [AppointmentStatus.Confirmed]: "success",
  [AppointmentStatus.Arrived]: "info",
  [AppointmentStatus.Completed]: "neutral",
  [AppointmentStatus.Canceled]: "danger",
  [AppointmentStatus.NoShow]: "danger",
};

/** The literal union the nuqs parser accepts. */
export const APPOINTMENT_STATUS_VALUES = [
  AppointmentStatus.Planned,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
  AppointmentStatus.Completed,
  AppointmentStatus.Canceled,
  AppointmentStatus.NoShow,
] as const;

export const APPOINTMENT_STATUS_OPTIONS = Object.entries(
  APPOINTMENT_STATUS_LABELS,
).map(([value, label]) => ({ value: value as AppointmentStatus, label }));

/** The menu item that moves an appointment INTO the keyed status. */
export const APPOINTMENT_STATUS_ACTION_LABELS: Record<
  AppointmentStatus,
  string
> = {
  [AppointmentStatus.Planned]: "Replanifier",
  [AppointmentStatus.Confirmed]: "Confirmer",
  [AppointmentStatus.Arrived]: "Patient arrivé",
  [AppointmentStatus.Completed]: "Terminer",
  [AppointmentStatus.Canceled]: "Annuler le rendez-vous",
  [AppointmentStatus.NoShow]: "Marquer absent",
};

/** The toast after a status change, keyed by the new status. */
export const APPOINTMENT_STATUS_TOASTS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Planned]: "Rendez-vous replanifié",
  [AppointmentStatus.Confirmed]: "Rendez-vous confirmé",
  [AppointmentStatus.Arrived]: "Patient en salle d’attente",
  [AppointmentStatus.Completed]: "Rendez-vous terminé",
  [AppointmentStatus.Canceled]: "Rendez-vous annulé",
  [AppointmentStatus.NoShow]: "Patient marqué absent",
};

// ── Views ───────────────────────────────────────────────────────────────────

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  [CalendarView.Day]: "Jour",
  [CalendarView.Week]: "Semaine",
  [CalendarView.Month]: "Mois",
  [CalendarView.Agenda]: "30 jours",
};

export const CALENDAR_VIEW_OPTIONS = Object.entries(CALENDAR_VIEW_LABELS).map(
  ([value, label]) => ({ value: value as CalendarView, label }),
);

/** The literal union the nuqs parser accepts. */
export const CALENDAR_VIEW_VALUES = [
  CalendarView.Day,
  CalendarView.Week,
  CalendarView.Month,
  CalendarView.Agenda,
] as const;

export const DEFAULT_CALENDAR_VIEW = CalendarView.Week;

/** The agenda view is a flat list of this many days from the anchor date. */
export const AGENDA_DAYS_TO_SHOW = 30;

// ── Booking warnings ────────────────────────────────────────────────────────

export const BOOKING_WARNING_LABELS: Record<BookingWarning, string> = {
  [BookingWarning.OutsideSchedule]:
    "Ce créneau est en dehors des horaires du praticien.",
  [BookingWarning.Closure]:
    "Ce créneau tombe pendant une absence du praticien ou une fermeture du cabinet.",
};

// ── Duration ────────────────────────────────────────────────────────────────

/** Bounds match the appointment types' own duration bounds. */
export const APPOINTMENT_DURATION_MIN = 5;
export const APPOINTMENT_DURATION_MAX = 480;
export const APPOINTMENT_DURATION_STEP = 5;
/** Used when no type is chosen and no duration is typed. */
export const APPOINTMENT_DEFAULT_DURATION = 30;

// ── Validation and server copy ──────────────────────────────────────────────

export const APPOINTMENT_VALIDATION_MESSAGES = {
  patientRequired: "Choisissez un patient",
  practitionerRequired: "Choisissez un praticien",
  dateInvalid: "Choisissez une date",
  timeInvalid: "Choisissez une heure",
  durationInvalid: `La durée doit être un nombre entier de minutes, entre ${APPOINTMENT_DURATION_MIN} et ${APPOINTMENT_DURATION_MAX}`,
  reasonTooLong: "Le motif est trop long",
  notesTooLong: "Les notes sont trop longues",
  statusInvalid: "Statut de rendez-vous invalide",
} as const;

export const APPOINTMENT_SERVER_ERRORS = {
  notFound: "Rendez-vous introuvable.",
  /** The exclusion constraint won a race the application check could not see. */
  slotJustTaken: "Ce créneau vient d'être réservé. Merci d'en choisir un autre.",
  missingReference:
    "Le patient, le praticien ou le type de rendez-vous sélectionné n’existe plus. Actualisez la page, puis réessayez.",
  typeNotFound: "Ce type de rendez-vous n’existe plus.",
  practitionerNotFound: "Ce praticien n’existe plus ou n’est plus actif.",
  /** Optimistic concurrency: the version token no longer matches. */
  appointmentChangedMeanwhile:
    "Ce rendez-vous a été modifié entre-temps. Rechargez-le avant de réessayer.",
  /** Same family, for a status someone else moved first. */
  statusChangedMeanwhile:
    "Le statut de ce rendez-vous a été modifié entre-temps. Rechargez-le avant de réessayer.",
} as const;

/** «Ce praticien a déjà un rendez-vous de 10 h 00 à 10 h 30.» */
export const overlapMessage = (from: string, to: string) =>
  `Ce praticien a déjà un rendez-vous de ${from} à ${to}. Choisissez un autre créneau.`;

export const illegalTransitionMessage = (
  from: AppointmentStatus,
  to: AppointmentStatus,
) =>
  `Impossible de passer un rendez-vous « ${APPOINTMENT_STATUS_LABELS[from]} » à « ${APPOINTMENT_STATUS_LABELS[to]} ».`;

// ── UI copy ─────────────────────────────────────────────────────────────────

export const APPOINTMENT_FIELD_LABELS = {
  patient: "Patient",
  practitioner: "Praticien",
  type: "Type de rendez-vous",
  date: "Date",
  time: "Heure",
  duration: "Durée (minutes)",
  reason: "Motif",
  notes: "Notes",
} as const;

export const APPOINTMENT_FIELD_PLACEHOLDERS = {
  patient: "Rechercher un patient…",
  practitioner: "Choisir un praticien",
  type: "Aucun type",
  date: "Choisir une date",
  reason: "ex. Douleur molaire, contrôle annuel…",
  notes: "Informations utiles pour l’équipe",
} as const;

export const APPOINTMENT_COPY = {
  pageTitle: "Rendez-vous",
  newButton: "Nouveau rendez-vous",
  newTitle: "Nouveau rendez-vous",
  newDescription:
    "Choisissez le patient, le praticien et le créneau. La durée est proposée selon le type de rendez-vous.",
  editTitle: "Modifier le rendez-vous",
  editDescription: "Changez le créneau, le praticien ou le motif.",
  created: "Rendez-vous enregistré",
  updated: "Rendez-vous mis à jour",
  removed: "Rendez-vous supprimé",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",
  cancel: "Annuler",
  confirmAnyway: "Confirmer quand même",
  warningTitle: "Créneau hors horaires",
  warningHint:
    "Vous pouvez tout de même enregistrer ce rendez-vous : cliquez sur « Confirmer quand même ».",
  edit: "Modifier",
  remove: "Supprimer",
  actionsLabel: "Actions du rendez-vous",
  removeTitle: "Supprimer ce rendez-vous ?",
  removeDescription:
    "Le rendez-vous est effacé définitivement de l’agenda et du dossier du patient. Les actes liés sont conservés mais ne seront plus rattachés à ce rendez-vous. Pour garder une trace, préférez « Annuler le rendez-vous ».",
  cancelTitle: "Annuler ce rendez-vous ?",
  cancelDescription:
    "Le créneau est libéré dans l’agenda. Un rendez-vous annulé ne peut pas être rétabli : il faudra en créer un nouveau.",
  noShowTitle: "Marquer le patient absent ?",
  noShowDescription:
    "Le rendez-vous reste dans l’historique du patient avec le statut « Absent ». Ce statut est définitif.",
  today: "Aujourd’hui",
  previous: "Période précédente",
  next: "Période suivante",
  allPractitioners: "Tous les praticiens",
  allStatuses: "Tous les statuts",
  clearFilters: "Effacer les filtres",
  patientFilter: "Patient filtré",
  emptyTitle: "Aucun rendez-vous",
  emptyFiltered:
    "Aucun rendez-vous ne correspond à ces critères sur cette période. Changez de période ou effacez les filtres.",
  emptyDefault: "Aucun rendez-vous sur cette période.",
  loadingTitle: "Chargement des rendez-vous",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des rendez-vous n’a pas pu être chargée. Veuillez réessayer.",
  noPractitioner: "Non attribué",
  noType: "Sans type",
  /** Stands in for a field the clinic has not recorded. */
  emptyField: "—",
  noPatientFound: "Aucun patient trouvé.",
} as const;

/** The day header row's count: «8 rendez-vous» (invariable). */
export const dayAppointmentCount = (count: number) => `${count} rendez-vous`;

export const APPOINTMENT_COLUMN_HEADERS = {
  time: "Horaire",
  patient: "Patient",
  practitioner: "Praticien",
  type: "Type",
  reason: "Motif",
  status: "Statut",
} as const;
