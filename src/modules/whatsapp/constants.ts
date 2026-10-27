import type { StatusTone } from "@/components/shared/status-badge";
import type { EnvKey } from "./provider-constants";
import {
  MessageChip,
  RappelsFilter,
  TemplateApproval,
  UnscheduledReason,
  WhatsappConsent,
  WhatsappEvent,
  WhatsappMessageStatus,
  WhatsappMode,
  WhatsappSkipReason,
  WhatsappTab,
  type BodySegment,
} from "./types";

/**
 * The only place French copy exists for this slice (06-ui.md §10), plus the
 * slice's fixed engine values. Every message below reaches a user verbatim.
 *
 * Clinic-facing copy speaks plain French (prompts/33b, decision 2): no env
 * variable, no «SID», «token», «webhook», «cron», «tâche planifiée»,
 * «Content», provider name or placeholder syntax — `copy.test.ts` fails the
 * build otherwise. The one exception is `DIAGNOSTIC_COPY`, shown only inside
 * the collapsed «Diagnostic technique (pour le support)». Technical values
 * (endpoints, codes, patterns) live in `provider-constants.ts`.
 */

// ── Sending ─────────────────────────────────────────────────────────────────

export const SEND_TIMEOUT_MS = 8_000;
export const CLAIM_LIMIT = 25;
export const SANDBOX_CLAIM_LIMIT = 10;
/** Spacing between two sends in one tick. The sandbox allows 1 per 3 s. */
export const SEND_SPACING_MS = 1_000;
export const SANDBOX_SEND_SPACING_MS = 3_200;
/** A row `sending` for longer than this is never resent automatically. */
export const STALE_SENDING_MINUTES = 10;
export const TRANSIENT_RETRY_MINUTES = 5;
export const MAX_SEND_ATTEMPTS = 3;
/** The cron route's `maxDuration`, in seconds, and the margin kept under it. */
export const CRON_MAX_DURATION_SECONDS = 60;
export const CRON_SAFETY_MARGIN_MS = 12_000;

// ── Template approval (prompts/33b) ─────────────────────────────────────────

/** Templates whose status one tick refreshes, at most — after sending. */
export const APPROVAL_REFRESH_LIMIT = 10;
/** The refresh step needs at least this much of the tick's budget left. */
export const APPROVAL_REFRESH_MIN_BUDGET_MS = 6_000;
/**
 * A submission claimed `pending` that never got its resource (the process
 * died mid-request) returns to draft after this long.
 */
export const APPROVAL_STUCK_MINUTES = 10;
/** WhatsApp's body limit for a template, counted on the canonical body. */
export const TEMPLATE_BODY_MAX = 1024;
/** WhatsApp refuses more than four spaces in a row. */
export const TEMPLATE_MAX_CONSECUTIVE_SPACES = 4;

// ── Rules ───────────────────────────────────────────────────────────────────

export const MAX_REMINDER_RULES = 3;
export const REMINDER_OFFSET_MIN = 60; // 1 hour
export const REMINDER_OFFSET_MAX = 7 * 24 * 60; // 7 days
export const DELAY_OFFSET_MIN = 0;
export const DELAY_OFFSET_MAX = 24 * 60; // 24 hours

export const DEFAULT_WINDOW_START = "09:00";
export const DEFAULT_WINDOW_END = "19:00";
export const DEFAULT_MIN_LEAD_MINUTES = 120;
/** The «Ne pas envoyer… moins de [2] heures» field: whole hours, 0 – 24. */
export const MIN_LEAD_HOURS_MAX = 24;

/** Statuses the repo treats as «still on the books» for a reminder. */
export const ACTIVE_APPOINTMENT_STATUSES = ["planned", "confirmed"] as const;
export const CANCELED_APPOINTMENT_STATUS = "canceled";

/** `getAttentionCount`'s horizon. */
export const ATTENTION_HORIZON_HOURS = 48;

export const JOURNAL_PAGE_SIZE = 25;
export const JOURNAL_MAX_RANGE_DAYS = 31;
export const JOURNAL_DEFAULT_DAYS = 7;

/** Occurrence keys of the events that happen once per appointment. */
export const OCCURRENCE_CREATED = "created";
export const OCCURRENCE_CANCELED = "canceled";

/**
 * Skip reasons a person can work around by sending the message by hand:
 * consent asked at the desk, a reminder too close to the appointment for the
 * automatic rule, the clinic phone filled in since. A landline or an invalid
 * number cannot be messaged at all — no manual send for those.
 */
export const MANUALLY_FIXABLE_SKIPS: readonly WhatsappSkipReason[] = [
  WhatsappSkipReason.NoConsent,
  WhatsappSkipReason.TooLate,
  WhatsappSkipReason.ClinicPhoneMissing,
];

// ── Message chips ───────────────────────────────────────────────────────────

/** 33's five values, in 33's positional order. */
export const CHIP_VALUES = [
  MessageChip.FirstName,
  MessageChip.Date,
  MessageChip.Time,
  MessageChip.ClinicName,
  MessageChip.ClinicPhone,
] as const;

export const CHIP_LABELS: Record<MessageChip, string> = {
  [MessageChip.FirstName]: "Prénom",
  [MessageChip.Date]: "Date",
  [MessageChip.Time]: "Heure",
  [MessageChip.ClinicName]: "Cabinet",
  [MessageChip.ClinicPhone]: "Téléphone",
};

export const CHIP_DESCRIPTIONS: Record<MessageChip, string> = {
  [MessageChip.FirstName]: "Prénom du patient",
  [MessageChip.Date]: "Date du rendez-vous",
  [MessageChip.Time]: "Heure du rendez-vous",
  [MessageChip.ClinicName]: "Nom du cabinet",
  [MessageChip.ClinicPhone]: "Téléphone du cabinet",
};

/**
 * The preview's sample values — also the example values sent with an
 * approval request. The clinic's real name and phone replace the last two
 * wherever they are known.
 */
export const CHIP_SAMPLES: Record<MessageChip, string> = {
  [MessageChip.FirstName]: "Karim",
  [MessageChip.Date]: "mercredi 15 octobre",
  [MessageChip.Time]: "14:30",
  [MessageChip.ClinicName]: "Cabinet Dentaire Dr Amrani",
  [MessageChip.ClinicPhone]: "05 28 84 32 17",
};

/** Events whose message must say when: «Date» and «Heure» are required. */
export const EVENTS_REQUIRING_DATE_TIME: readonly WhatsappEvent[] = [
  WhatsappEvent.Reminder,
  WhatsappEvent.Confirmation,
  WhatsappEvent.Reschedule,
];

/**
 * Words that read as marketing. WhatsApp may re-categorise or refuse a
 * Utility template that contains them: the editor warns, never blocks.
 */
export const PROMOTIONAL_WORDS = [
  "promo",
  "promotion",
  "réduction",
  "remise",
  "offre",
  "gratuit",
  "gratuite",
  "soldes",
  "cadeau",
  "profitez",
  "exclusif",
  "exclusive",
  "%",
] as const;

const text = (value: string): BodySegment => ({ type: "text", text: value });
const chip = (value: MessageChip): BodySegment => ({ type: "chip", chip: value });

/** The default message of each event — 33's suggested French bodies. */
export const DEFAULT_BODIES: Record<WhatsappEvent, BodySegment[]> = {
  [WhatsappEvent.Reminder]: [
    text("Bonjour "),
    chip(MessageChip.FirstName),
    text(", nous vous rappelons votre rendez-vous le "),
    chip(MessageChip.Date),
    text(" à "),
    chip(MessageChip.Time),
    text(" au "),
    chip(MessageChip.ClinicName),
    text(". Pour le modifier ou l’annuler, appelez le "),
    chip(MessageChip.ClinicPhone),
    text("."),
  ],
  [WhatsappEvent.Confirmation]: [
    text("Bonjour "),
    chip(MessageChip.FirstName),
    text(", votre rendez-vous est confirmé le "),
    chip(MessageChip.Date),
    text(" à "),
    chip(MessageChip.Time),
    text(" au "),
    chip(MessageChip.ClinicName),
    text(". Pour toute question, appelez le "),
    chip(MessageChip.ClinicPhone),
    text("."),
  ],
  [WhatsappEvent.Reschedule]: [
    text("Bonjour "),
    chip(MessageChip.FirstName),
    text(", votre rendez-vous a été déplacé au "),
    chip(MessageChip.Date),
    text(" à "),
    chip(MessageChip.Time),
    text(" au "),
    chip(MessageChip.ClinicName),
    text(". Pour toute question, appelez le "),
    chip(MessageChip.ClinicPhone),
    text("."),
  ],
  [WhatsappEvent.Cancellation]: [
    text("Bonjour "),
    chip(MessageChip.FirstName),
    text(", votre rendez-vous du "),
    chip(MessageChip.Date),
    text(" à "),
    chip(MessageChip.Time),
    text(" au "),
    chip(MessageChip.ClinicName),
    text(" a été annulé. Pour reprendre rendez-vous, appelez le "),
    chip(MessageChip.ClinicPhone),
    text("."),
  ],
};

/** The four seeded templates' names. */
export const DEFAULT_TEMPLATE_NAMES: Record<WhatsappEvent, string> = {
  [WhatsappEvent.Reminder]: "Rappel 24 h",
  [WhatsappEvent.Confirmation]: "Confirmation",
  [WhatsappEvent.Reschedule]: "Modification",
  [WhatsappEvent.Cancellation]: "Annulation",
};

// ── Labels ──────────────────────────────────────────────────────────────────

export const EVENT_VALUES = [
  WhatsappEvent.Reminder,
  WhatsappEvent.Confirmation,
  WhatsappEvent.Reschedule,
  WhatsappEvent.Cancellation,
] as const;

export const EVENT_LABELS: Record<WhatsappEvent, string> = {
  [WhatsappEvent.Reminder]: "Rappel",
  [WhatsappEvent.Confirmation]: "Confirmation",
  [WhatsappEvent.Reschedule]: "Modification",
  [WhatsappEvent.Cancellation]: "Annulation",
};

export const EVENT_TONES: Record<WhatsappEvent, StatusTone> = {
  [WhatsappEvent.Reminder]: "brand",
  [WhatsappEvent.Confirmation]: "success",
  [WhatsappEvent.Reschedule]: "info",
  [WhatsappEvent.Cancellation]: "danger",
};

export const EVENT_OPTIONS = EVENT_VALUES.map((value) => ({
  value,
  label: EVENT_LABELS[value],
}));

export const CONSENT_VALUES = [
  WhatsappConsent.Granted,
  WhatsappConsent.Declined,
  WhatsappConsent.Unknown,
] as const;

export const CONSENT_LABELS: Record<WhatsappConsent, string> = {
  [WhatsappConsent.Granted]: "Accepté",
  [WhatsappConsent.Declined]: "Refusé",
  [WhatsappConsent.Unknown]: "Non renseigné",
};

export const CONSENT_OPTIONS = CONSENT_VALUES.map((value) => ({
  value,
  label: CONSENT_LABELS[value],
}));

/** The patient form's field and the patients list's filter. */
export const CONSENT_FIELD_COPY = {
  label: "Rappels WhatsApp",
  help: "À renseigner avec l’accord du patient.",
  allLabel: "Tous les consentements",
  filterLabel: "Filtrer par consentement WhatsApp",
} as const;

export const STATUS_VALUES = [
  WhatsappMessageStatus.Scheduled,
  WhatsappMessageStatus.Sending,
  WhatsappMessageStatus.Sent,
  WhatsappMessageStatus.Delivered,
  WhatsappMessageStatus.Read,
  WhatsappMessageStatus.Failed,
  WhatsappMessageStatus.Skipped,
  WhatsappMessageStatus.Canceled,
  WhatsappMessageStatus.NeedsAttention,
  WhatsappMessageStatus.ManualOpened,
] as const;

export const STATUS_LABELS: Record<WhatsappMessageStatus, string> = {
  [WhatsappMessageStatus.Scheduled]: "Planifié",
  [WhatsappMessageStatus.Sending]: "Envoi en cours",
  [WhatsappMessageStatus.Sent]: "Envoyé",
  [WhatsappMessageStatus.Delivered]: "Délivré",
  [WhatsappMessageStatus.Read]: "Lu",
  [WhatsappMessageStatus.Failed]: "Échec",
  [WhatsappMessageStatus.Skipped]: "Ignoré",
  [WhatsappMessageStatus.Canceled]: "Annulé",
  [WhatsappMessageStatus.NeedsAttention]: "À vérifier",
  [WhatsappMessageStatus.ManualOpened]: "Ouvert (manuel)",
};

export const STATUS_TONES: Record<WhatsappMessageStatus, StatusTone> = {
  [WhatsappMessageStatus.Scheduled]: "info",
  [WhatsappMessageStatus.Sending]: "info",
  [WhatsappMessageStatus.Sent]: "brand",
  [WhatsappMessageStatus.Delivered]: "success",
  [WhatsappMessageStatus.Read]: "success",
  [WhatsappMessageStatus.Failed]: "danger",
  [WhatsappMessageStatus.Skipped]: "neutral",
  [WhatsappMessageStatus.Canceled]: "neutral",
  [WhatsappMessageStatus.NeedsAttention]: "warning",
  [WhatsappMessageStatus.ManualOpened]: "brand",
};

export const STATUS_OPTIONS = STATUS_VALUES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export const SKIP_REASON_LABELS: Record<WhatsappSkipReason, string> = {
  [WhatsappSkipReason.NoConsent]: "pas de consentement",
  [WhatsappSkipReason.InvalidPhone]: "numéro invalide",
  [WhatsappSkipReason.Landline]: "numéro fixe",
  [WhatsappSkipReason.TooLate]: "trop tard pour l’envoyer",
  [WhatsappSkipReason.AppointmentStatus]: "rendez-vous modifié ou annulé",
  [WhatsappSkipReason.ClinicPhoneMissing]: "téléphone du cabinet manquant",
  [WhatsappSkipReason.Superseded]: "remplacé par un message plus récent",
  [WhatsappSkipReason.TemplateUnapproved]: "modèle pas encore approuvé par WhatsApp",
};

/**
 * Sending errors in plain French, by code. The raw code and the provider's
 * own wording appear only in «Diagnostic technique».
 */
export const SEND_ERROR_LABELS: Record<string, string> = {
  "63015": "numéro non enregistré pour le mode test",
  "63016": "message refusé : le patient n’a pas écrit au cabinet depuis plus de 24 h",
  "21211": "numéro refusé par WhatsApp",
  timeout: "pas de réponse au moment de l’envoi : vérifiez avant de renvoyer",
  network_error: "connexion interrompue pendant l’envoi : vérifiez avant de renvoyer",
  missing_sid: "envoi incertain : vérifiez avant de renvoyer",
  template_not_configured: "modèle pas encore approuvé par WhatsApp",
  manual_mode: "envois automatiques désactivés",
};

/** «erreur d’envoi (code 30008)» for anything not mapped above. */
export const sendErrorLabel = (code: string) =>
  SEND_ERROR_LABELS[code] ??
  (/^http_(429|5\d\d)$/.test(code)
    ? "service d’envoi momentanément indisponible"
    : `erreur d’envoi (code ${code})`);

export const UNSCHEDULED_LABEL = "Non planifié";

export const UNSCHEDULED_REASON_LABELS: Record<UnscheduledReason, string> = {
  [UnscheduledReason.NoRule]: "aucun message prévu",
  [UnscheduledReason.InvalidPhone]: "numéro invalide",
  [UnscheduledReason.Landline]: "numéro fixe",
  [UnscheduledReason.NoConsent]: "pas de consentement",
};

export const MODE_LABELS: Record<WhatsappMode, string> = {
  [WhatsappMode.Automatic]: "Automatique",
  [WhatsappMode.Sandbox]: "Mode test",
  [WhatsappMode.Manual]: "Manuel",
};

export const TAB_VALUES = [
  WhatsappTab.Service,
  WhatsappTab.Templates,
  WhatsappTab.Rules,
  WhatsappTab.Journal,
] as const;

export const TAB_LABELS: Record<WhatsappTab, string> = {
  [WhatsappTab.Service]: "Connexion",
  [WhatsappTab.Templates]: "Modèles de messages",
  [WhatsappTab.Rules]: "Automatisations",
  [WhatsappTab.Journal]: "Journal d’envois",
};

export const RAPPELS_FILTER_VALUES = [
  RappelsFilter.All,
  RappelsFilter.Scheduled,
  RappelsFilter.Sent,
  RappelsFilter.Delivered,
  RappelsFilter.NeedsAttention,
] as const;

export const RAPPELS_FILTER_LABELS: Record<RappelsFilter, string> = {
  [RappelsFilter.All]: "Tous",
  [RappelsFilter.Scheduled]: "Planifiés",
  [RappelsFilter.Sent]: "Envoyés",
  [RappelsFilter.Delivered]: "Délivrés / lus",
  [RappelsFilter.NeedsAttention]: "À vérifier",
};

export const APPROVAL_LABELS: Record<TemplateApproval, string> = {
  [TemplateApproval.Draft]: "Brouillon",
  [TemplateApproval.Pending]: "En attente de validation WhatsApp",
  [TemplateApproval.Approved]: "Approuvé",
  [TemplateApproval.Rejected]: "Refusé",
};

export const APPROVAL_TONES: Record<TemplateApproval, StatusTone> = {
  [TemplateApproval.Draft]: "neutral",
  [TemplateApproval.Pending]: "info",
  [TemplateApproval.Approved]: "success",
  [TemplateApproval.Rejected]: "danger",
};

/**
 * WhatsApp's rejection codes, in French. Twilio documents
 * TAG_CONTENT_MISMATCH and INVALID_FORMAT; the others are Meta's own codes.
 * Anything else falls back to the generic sentence.
 */
export const REJECTION_REASON_LABELS: Record<string, string> = {
  TAG_CONTENT_MISMATCH:
    "La catégorie ou la langue ne correspond pas au texte du message.",
  INVALID_FORMAT:
    "Le message contient un élément mal placé : une étiquette en début ou en fin de texte, ou deux étiquettes côte à côte.",
  INCORRECT_CATEGORY:
    "WhatsApp considère ce message comme commercial, pas comme un message de service.",
  PROMOTIONAL:
    "WhatsApp considère ce message comme commercial, pas comme un message de service.",
  ABUSIVE_CONTENT: "WhatsApp juge le contenu du message inapproprié.",
  SCAM: "WhatsApp juge le contenu du message trompeur.",
  paused: "WhatsApp a suspendu ce modèle.",
  disabled: "WhatsApp a désactivé ce modèle.",
};

export const REJECTION_REASON_FALLBACK =
  "WhatsApp a refusé ce modèle. Reformulez le message de façon factuelle et renvoyez-le.";

/** WhatsApp's raw reason → the sentence the admin reads. */
export const rejectionReasonLabel = (reason: string | null) => {
  const key = reason?.trim() ?? "";
  if (!key) return REJECTION_REASON_FALLBACK;
  return (
    REJECTION_REASON_LABELS[key] ??
    REJECTION_REASON_LABELS[key.toUpperCase()] ??
    REJECTION_REASON_FALLBACK
  );
};

/** The timing units the rule dialog offers, in minutes. */
export const TIMING_UNITS = [
  { value: "minutes", label: "minutes", minutes: 1 },
  { value: "hours", label: "heures", minutes: 60 },
  { value: "days", label: "jours", minutes: 24 * 60 },
] as const;

export type TimingUnit = (typeof TIMING_UNITS)[number]["value"];

// ── Server errors ───────────────────────────────────────────────────────────

export const WHATSAPP_ERRORS = {
  messageNotFound: "Message introuvable.",
  templateNotFound: "Modèle introuvable.",
  ruleNotFound: "Règle introuvable.",
  templateInUse:
    "Ce modèle est utilisé par une règle d’envoi. Supprimez ou modifiez d’abord la règle.",
  templateKindInUse:
    "Ce modèle est utilisé par une règle d’envoi : son événement ne peut plus changer.",
  templateNameTaken: "Un modèle porte déjà ce nom.",
  tooManyReminders: "Trois règles de rappel au maximum.",
  ruleExistsForEvent: "Une règle existe déjà pour cet événement.",
  duplicateReminderOffset: "Une règle de rappel existe déjà avec ce délai.",
  templateInactive: "Ce modèle est désactivé.",
  manualNotAllowed:
    "Ce message ne doit plus être envoyé : le rendez-vous a changé ou a été annulé.",
  manualNotNeeded:
    "Ce message part automatiquement : l’envoi manuel est réservé aux messages à vérifier.",
  consentDeclined: "Le patient a refusé les messages WhatsApp.",
  invalidPhone: "Le numéro du patient n’est pas un mobile valide.",
  retryNotAllowed: "Ce message ne peut pas être renvoyé.",
  clinicPhoneMissing:
    "Renseignez le téléphone du cabinet dans Paramètres › Général avant d’activer les envois.",
  notConnected:
    "WhatsApp n’est pas connecté : les envois automatiques ne peuvent pas être activés. Contactez le support DentaFlow.",
  testFailed: "Le message test n’a pas pu être envoyé",
  testTemplateUnapproved:
    "Le modèle de cet événement n’est pas encore approuvé par WhatsApp : le message test ne peut pas partir.",
  rangeTooLong: "La période ne peut pas dépasser 31 jours.",
  rangeOrder: "La date de fin doit suivre la date de début.",
  approvalUnavailable:
    "WhatsApp n’est pas connecté : le modèle ne peut pas être envoyé pour validation. Il reste enregistré comme brouillon.",
  approvalSandbox:
    "En mode test, les modèles ne sont pas envoyés pour validation : le texte est utilisé tel quel.",
  approvalFailed:
    "La demande de validation n’a pas pu être envoyée à WhatsApp. Le modèle reste un brouillon : réessayez dans quelques minutes.",
  approvalRefreshFailed:
    "Le statut des modèles n’a pas pu être actualisé. Réessayez dans quelques minutes.",
} as const;

export const WHATSAPP_VALIDATION = {
  nameRequired: "Le nom du modèle est obligatoire",
  nameTooLong: "Le nom du modèle est trop long",
  bodyRequired: "Le message est obligatoire",
  bodyTooLong: `Le message est trop long (${TEMPLATE_BODY_MAX} caractères au maximum)`,
  bodyBraces: "Les accolades ne sont pas autorisées dans le message",
  bodyLineBreak: "Le message doit tenir sur une seule ligne, sans tabulation",
  bodySpaces: "Pas plus de quatre espaces à la suite",
  bodyEdgeChip:
    "Le message ne peut ni commencer ni finir par une étiquette : ajoutez un mot avant ou après",
  bodyAdjacentChips: "Séparez deux étiquettes par au moins un mot",
  bodyDateTime: "Ajoutez au moins les étiquettes « Date » et « Heure »",
  bodyInvalid: "Le message contient un élément inconnu",
  windowFormat: "Heure invalide (format 24 h, par exemple 09:00)",
  windowOrder: "L’heure de fin doit suivre l’heure de début",
  minLead: "Le délai minimum doit être compris entre 0 et 1 440 minutes",
  minLeadHours: `Indiquez un nombre entier d’heures, entre 0 et ${MIN_LEAD_HOURS_MAX}`,
  offsetReminder: "Un rappel part entre 1 heure et 7 jours avant le rendez-vous",
  offsetDelay: "Le délai doit être compris entre 0 et 24 heures",
  offsetInteger: "Le délai doit être un nombre entier",
  phoneRequired: "Le numéro est obligatoire",
  phoneInvalid: "Numéro WhatsApp invalide",
  event: "Événement invalide",
  templateRequired: "Choisissez un modèle",
  day: "Jour invalide",
} as const;

// ── Screens ─────────────────────────────────────────────────────────────────

export const WHATSAPP_COPY = {
  sectionTitle: "WhatsApp",
  // Rappels page
  rappelsTitle: "Rappels",
  rappelsDescription: "Les messages WhatsApp des rendez-vous du jour choisi.",
  monitoringTitle: "Suivi des envois",
  monitoringDescription:
    "Les messages partent automatiquement. Seuls ceux marqués « À vérifier » demandent votre attention.",
  workListTitle: "Messages à envoyer",
  notConnectedCard:
    "WhatsApp n’est pas encore connecté. Les rappels ne partent pas automatiquement.",
  notConnectedCardHelp:
    "Ouvrez chaque message dans WhatsApp avec « Envoyer sur WhatsApp », ou « Suivant » pour enchaîner.",
  switchedOffCard:
    "Les envois automatiques sont désactivés. Les rappels ne partent pas automatiquement.",
  switchedOffHelp:
    "Un administrateur peut les réactiver dans Paramètres › WhatsApp › Connexion.",
  sandboxBanner:
    "Mode test : seuls les numéros enregistrés pour le test reçoivent les messages.",
  today: "Aujourd’hui",
  tomorrow: "Demain",
  dayLabel: "Jour",
  summaryScheduled: "Planifiés",
  summarySent: "Envoyés",
  summaryDelivered: "Délivrés",
  summaryRead: "Lus",
  summaryAttention: "À vérifier",
  emptyDay: "Aucun rendez-vous ce jour-là.",
  emptyDayDescription: "Choisissez un autre jour pour voir ses messages.",
  emptyFilter: "Aucun message ne correspond à ce filtre.",
  colTime: "Heure",
  colPatient: "Patient",
  colPhone: "Téléphone",
  colPractitioner: "Praticien",
  colEvent: "Événement",
  colStatus: "Statut",
  colSentAt: "Envoyé à",
  colActions: "Actions",
  colDate: "Date d’envoi",
  colAppointment: "Rendez-vous",
  sendOnWhatsapp: "Envoyer sur WhatsApp",
  sendManually: "Envoyer manuellement",
  retry: "Réessayer",
  next: "Suivant",
  nextNone: "Tous les messages du jour ont été ouverts.",
  opened: "Message ouvert dans WhatsApp",
  retried: "Message replanifié",
  noPractitioner: "—",
  loadingTitle: "Chargement des rappels",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Rappels indisponibles",
  errorDescription: "Les messages n’ont pas pu être chargés.",
  retryLoad: "Réessayer",
  // Dashboard
  dashboardCard: "Messages WhatsApp à vérifier",
  dashboardHint: "Échecs et envois incertains des 48 prochaines heures",
  // Appointment badge
  latestPlannedAt: (date: string, time: string) => `Planifié le ${date} à ${time}`,
  // Settings — connexion
  connected: "WhatsApp connecté",
  connectedSandbox: "WhatsApp connecté en mode test",
  notConnected: "WhatsApp non connecté — contactez le support DentaFlow",
  senderLabel: "Numéro d’envoi",
  connectedHelp: "Les messages partent de ce numéro WhatsApp.",
  notConnectedHelp:
    "Tant que la connexion n’est pas faite, la page « Rappels » liste les messages à envoyer à la main.",
  globalSwitch: "Envois automatiques",
  globalSwitchOn: "Activés : les messages partent seuls, aux heures prévues.",
  globalSwitchOff: "Désactivés : rien ne part seul, la page « Rappels » liste les messages à envoyer.",
  switchDisabledConnection: "Disponible une fois WhatsApp connecté.",
  switchDisabledPhone:
    "Renseignez le téléphone du cabinet dans Paramètres › Général pour activer les envois.",
  hoursTitle: "Heures d’envoi",
  hoursHelp: "Aucun message ne part en dehors de ces heures.",
  windowStart: "De",
  windowEnd: "À",
  minLeadBefore: "Ne pas envoyer un rappel si le rendez-vous a lieu dans moins de",
  minLeadAfter: "heures",
  minLeadLabel: "Délai minimum en heures",
  saveSettings: "Enregistrer",
  saving: "Enregistrement…",
  settingsSaved: "Paramètres WhatsApp enregistrés",
  testTitle: "Envoyer un message test à mon numéro",
  testHelp:
    "Reçoit sur votre téléphone le message de l’événement choisi, avec des valeurs d’exemple.",
  testPhone: "Mon numéro WhatsApp",
  testPhonePlaceholder: "ex. 06 12 34 56 78",
  testEvent: "Événement",
  testSend: "Envoyer le test",
  testSending: "Envoi…",
  testSent: "Message test envoyé : il arrive sur votre téléphone dans quelques secondes",
  testUnavailable: "Disponible une fois WhatsApp connecté.",
  bulkTitle: "Consentement des patients",
  bulkHelp:
    "Marque comme consentants tous les patients dont le consentement n’est pas renseigné.",
  bulkAction: "Marquer tous les patients non renseignés comme consentants",
  bulkConfirmTitle: "Confirmer le consentement ?",
  bulkConfirmDescription:
    "Le cabinet atteste que ces patients ont accepté de recevoir des rappels WhatsApp. Tous les patients « Non renseigné » passeront à « Accepté ». Cette action est enregistrée dans l’activité.",
  bulkDone: (count: number) =>
    count === 0
      ? "Aucun patient à mettre à jour"
      : `${count} patient${count > 1 ? "s" : ""} marqué${count > 1 ? "s" : ""} comme consentant${count > 1 ? "s" : ""}`,
  backfill: "Planifier les rappels des rendez-vous à venir",
  backfillHelp:
    "Crée les rappels manquants pour les rendez-vous futurs (fait automatiquement à l’activation).",
  backfillDone: (count: number) =>
    `${count} rappel${count > 1 ? "s" : ""} planifié${count > 1 ? "s" : ""}`,
  // Settings — templates
  templatesIntro:
    "Écrivez vos messages ici. Chaque modèle est envoyé à WhatsApp pour validation ; un modèle approuvé peut ensuite partir automatiquement.",
  templatesTestMode:
    "En mode test, les messages utilisent le texte ci-dessous sans validation WhatsApp.",
  templatesNotConnected:
    "WhatsApp n’est pas encore connecté : les modèles restent des brouillons et servent aux envois manuels.",
  submitAllDrafts: "Envoyer tous les modèles pour validation",
  submitAllDone: (submitted: number, failed: number) =>
    submitted === 0 && failed === 0
      ? "Aucun brouillon à envoyer"
      : `${submitted} modèle${submitted > 1 ? "s" : ""} envoyé${submitted > 1 ? "s" : ""} pour validation${failed > 0 ? ` · ${failed} en échec` : ""}`,
  refreshStatuses: "Actualiser",
  refreshDone: "Statuts actualisés",
  newTemplate: "Nouveau modèle",
  editTemplate: "Modifier le modèle",
  templateDialogDescription:
    "Écrivez le message et insérez les informations du rendez-vous avec les étiquettes.",
  templateName: "Nom",
  templateNamePlaceholder: "ex. Rappel 24 h",
  templateNameHelp: "Visible uniquement par le cabinet.",
  templateKind: "Événement",
  templateBody: "Message",
  templateBodyHelp:
    "Cliquez sur une étiquette pour l’insérer à l’emplacement du curseur.",
  insertChip: "Insérer",
  insertChipLabel: (label: string) => `Insérer l’étiquette « ${label} »`,
  removeChipLabel: (label: string) => `Étiquette « ${label} »`,
  templateActive: "Actif",
  inactive: "Désactivé",
  preview: "Aperçu",
  previewHelp: "Ce que le patient reçoit, avec des exemples.",
  promotionalWarning:
    "Évitez les formulations commerciales : WhatsApp pourrait refuser le modèle.",
  bodyLength: (length: number, max: number) => `${length} / ${max} caractères`,
  save: "Enregistrer",
  saveAsDraft: "Enregistrer le brouillon",
  saveAndSubmit: "Enregistrer et envoyer pour validation",
  submitting: "Envoi pour validation…",
  templateSaved: "Modèle enregistré",
  templateSubmitted: "Modèle envoyé à WhatsApp pour validation",
  templateDeleted: "Modèle supprimé",
  deleteTemplate: "Supprimer",
  deleteTemplateTitle: "Supprimer ce modèle ?",
  deleteTemplateDescription:
    "Le modèle sera définitivement supprimé. Les messages déjà envoyés restent dans le journal.",
  templatesEmpty: "Aucun modèle",
  templatesEmptyDescription: "Créez un modèle pour chaque événement à automatiser.",
  submitForApproval: "Envoyer pour validation",
  fixAndResubmit: "Corriger et renvoyer",
  submittedOn: (date: string) => `Envoyé le ${date}`,
  approvedOn: (date: string) => `Approuvé le ${date}`,
  previousVersionActive:
    "La version approuvée précédente continue de partir jusqu’à la validation de ce texte.",
  pendingHelp:
    "WhatsApp examine le modèle, en général en quelques minutes à quelques heures.",
  edit: "Modifier",
  cancel: "Annuler",
  // Settings — rules
  rulesTitle: "Règles d’envoi automatique",
  rulesAdvice:
    "Évitez les envois tardifs : les heures d’envoi s’appliquent à toutes les règles. Les modifications et annulations partent immédiatement ; un rappel 24 heures avant le rendez-vous est l’usage le plus courant.",
  ruleTemplateUnapproved:
    "Ce modèle n’est pas encore approuvé : les envois de cette règle sont suspendus.",
  addRule: "Ajouter une règle",
  editRule: "Modifier la règle",
  ruleDialogDescription: "Le modèle choisi fixe l’événement déclencheur.",
  colTemplate: "Modèle associé",
  colTrigger: "Événement déclencheur",
  colTiming: "Programmation",
  colRuleStatus: "Statut",
  ruleEnabled: "Activée",
  ruleDisabled: "Désactivée",
  ruleTemplate: "Modèle",
  ruleTiming: "Programmation",
  ruleValue: "Valeur",
  ruleUnit: "Unité",
  before: "Avant",
  after: "Après",
  immediate: "Immédiat",
  ruleSaved: "Règle enregistrée",
  ruleDeleted: "Règle supprimée",
  deleteRule: "Supprimer",
  deleteRuleTitle: "Supprimer cette règle ?",
  deleteRuleDescription:
    "Les messages encore planifiés par cette règle seront annulés. Les messages déjà envoyés restent dans le journal.",
  rulesEmpty: "Aucune règle",
  rulesEmptyDescription: "Ajoutez une règle pour automatiser un message.",
  noTemplateAvailable: "Aucun modèle disponible : créez d’abord un modèle.",
  // Settings — journal
  journalFrom: "Du",
  journalTo: "Au",
  allEvents: "Tous les événements",
  allStatuses: "Tous les statuts",
  journalSearch: "Rechercher un patient…",
  journalEmpty: "Aucun message sur cette période.",
  // Shared states
  copied: "Copié",
  copyText: "Copier",
  settingsLoadingTitle: "Chargement de WhatsApp",
  settingsErrorTitle: "WhatsApp indisponible",
  settingsErrorDescription: "Les réglages WhatsApp n’ont pas pu être chargés.",
} as const;

/**
 * «Diagnostic technique (pour le support)» — the ONLY copy allowed to name
 * env variables, the provider, the scheduled task or the callback address.
 * Shown collapsed at the bottom of «Connexion», for whoever supports the clinic.
 */
export const DIAGNOSTIC_COPY = {
  title: "Diagnostic technique (pour le support)",
  description:
    "Informations destinées au support DentaFlow. Rien ici n’est nécessaire au quotidien.",
  envTitle: "Variables d’environnement",
  envLabels: {
    TWILIO_ACCOUNT_SID: "Identifiant du compte Twilio (Account SID)",
    TWILIO_AUTH_TOKEN: "Jeton d’authentification Twilio (Auth Token)",
    TWILIO_WHATSAPP_FROM: "Numéro d’envoi WhatsApp",
    CRON_SECRET: "Secret de la tâche planifiée (cron)",
    NEXT_PUBLIC_APP_URL: "Adresse publique de l’application",
  } satisfies Record<EnvKey, string>,
  present: "Configuré",
  missing: "Manquant",
  mode: "Mode calculé",
  webhookUrl: "Adresse de retour des statuts (webhook Twilio)",
  webhookHelp:
    "Chaque message transmet cette adresse à Twilio : aucune configuration n’est nécessaire dans la console.",
  lastRun: "Dernier passage de la tâche planifiée (cron)",
  lastRunNever: "Jamais",
  lastRunCounts: (claimed: number, sent: number, failed: number, attention: number) =>
    `${claimed} pris en charge · ${sent} envoyés · ${failed} échecs · ${attention} à vérifier`,
  counters: "Messages par statut",
  counters24h: "24 h",
  counters7d: "7 jours",
  privacyHelp:
    "Twilio et Meta (WhatsApp) traitent le numéro du destinataire et le contenu du message. Les obligations de la loi 09-08 et les déclarations auprès de la CNDP restent à la charge du cabinet.",
} as const;

/** «24 heures avant», «Immédiat», «2 heures après». */
export const formatTiming = (event: WhatsappEvent, offsetMinutes: number) => {
  if (event !== WhatsappEvent.Reminder && offsetMinutes === 0) {
    return WHATSAPP_COPY.immediate;
  }
  const unit =
    offsetMinutes % (24 * 60) === 0
      ? { size: 24 * 60, one: "jour", many: "jours" }
      : offsetMinutes % 60 === 0
        ? { size: 60, one: "heure", many: "heures" }
        : { size: 1, one: "minute", many: "minutes" };
  const count = offsetMinutes / unit.size;
  const direction = event === WhatsappEvent.Reminder ? "avant" : "après";
  return `${count} ${count > 1 ? unit.many : unit.one} ${direction}`;
};
