import type { StatusTone } from "@/components/shared/status-badge";
import {
  RappelsFilter,
  UnscheduledReason,
  WhatsappConsent,
  WhatsappEvent,
  WhatsappMessageStatus,
  WhatsappMode,
  WhatsappSkipReason,
  WhatsappTab,
} from "./types";

/**
 * The only place French copy exists for this slice (06-ui.md §10), plus the
 * slice's fixed technical values. Every message below reaches a user verbatim.
 */

// ── Twilio ──────────────────────────────────────────────────────────────────

/** The REST API version every request is pinned to. */
export const TWILIO_API_VERSION = "2010-04-01";
export const TWILIO_API_BASE = `https://api.twilio.com/${TWILIO_API_VERSION}`;

/**
 * Twilio's shared WhatsApp Sandbox sender (twilio.com/docs/whatsapp/sandbox).
 * `TWILIO_WHATSAPP_FROM` equal to this ⇒ sandbox mode.
 */
export const TWILIO_SANDBOX_NUMBER = "+14155238886";

/** A Content Template SID: «HX» + 32 hex digits (the Message resource docs). */
export const CONTENT_SID_PATTERN = /^HX[0-9a-fA-F]{32}$/;

/** `TWILIO_WHATSAPP_FROM` as Twilio expects it: `whatsapp:+<E.164>`. */
export const WHATSAPP_FROM_PATTERN = /^whatsapp:\+[1-9]\d{7,14}$/;

/** Twilio error codes the docs name for WhatsApp (twilio.com/docs/api/errors). */
export const TWILIO_ERROR_CODES = {
  /** The recipient has not joined the sandbox. */
  sandboxNotJoined: "63015",
  /** Free-form message outside the 24-hour customer-service window. */
  outsideWindow: "63016",
} as const;

/**
 * `failed` rows whose error is worth a manual «Réessayer»: the recipient may
 * have joined the sandbox since, or Twilio had a passing problem. Everything
 * else (invalid number, unapproved template…) would fail the same way again.
 */
export const RETRYABLE_ERROR_CODES: readonly string[] = [
  TWILIO_ERROR_CODES.sandboxNotJoined,
  "30001", // Queue overflow
  "30008", // Unknown error
  "63018", // Rate limit exceeded for the channel
];

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

// ── Rules ───────────────────────────────────────────────────────────────────

export const MAX_REMINDER_RULES = 3;
export const REMINDER_OFFSET_MIN = 60; // 1 hour
export const REMINDER_OFFSET_MAX = 7 * 24 * 60; // 7 days
export const DELAY_OFFSET_MIN = 0;
export const DELAY_OFFSET_MAX = 24 * 60; // 24 hours

export const DEFAULT_WINDOW_START = "09:00";
export const DEFAULT_WINDOW_END = "19:00";
export const DEFAULT_MIN_LEAD_MINUTES = 120;

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

// ── Message variables ───────────────────────────────────────────────────────

/** The five positional variables every template uses, in order. */
export const MESSAGE_VARIABLES = [
  { position: 1, token: "{prenom}", label: "Prénom du patient", sample: "Karim" },
  { position: 2, token: "{date}", label: "Date du rendez-vous", sample: "mercredi 15 octobre" },
  { position: 3, token: "{heure}", label: "Heure du rendez-vous", sample: "14:30" },
  { position: 4, token: "{cabinet}", label: "Nom du cabinet", sample: "Cabinet Dentaire Dr Amrani" },
  { position: 5, token: "{telephone}", label: "Téléphone du cabinet", sample: "05 28 84 32 17" },
] as const;

/**
 * The suggested bodies to create and get approved as Twilio Content
 * Templates (Utility, French). Shown read-only with «Copier le texte».
 */
export const APPROVED_BODIES: Record<WhatsappEvent, string> = {
  [WhatsappEvent.Reminder]:
    "Bonjour {{1}}, nous vous rappelons votre rendez-vous le {{2}} à {{3}} au {{4}}. Pour le modifier ou l’annuler, appelez le {{5}}.",
  [WhatsappEvent.Confirmation]:
    "Bonjour {{1}}, votre rendez-vous est confirmé le {{2}} à {{3}} au {{4}}. Pour toute question, appelez le {{5}}.",
  [WhatsappEvent.Reschedule]:
    "Bonjour {{1}}, votre rendez-vous a été déplacé au {{2}} à {{3}} au {{4}}. Pour toute question, appelez le {{5}}.",
  [WhatsappEvent.Cancellation]:
    "Bonjour {{1}}, votre rendez-vous du {{2}} à {{3}} au {{4}} a été annulé. Pour reprendre rendez-vous, appelez le {{5}}.",
};

/** The same bodies with the manual-mode tokens — the default `manualText`. */
export const DEFAULT_MANUAL_TEXTS: Record<WhatsappEvent, string> = {
  [WhatsappEvent.Reminder]:
    "Bonjour {prenom}, nous vous rappelons votre rendez-vous le {date} à {heure} au {cabinet}. Pour le modifier ou l’annuler, appelez le {telephone}.",
  [WhatsappEvent.Confirmation]:
    "Bonjour {prenom}, votre rendez-vous est confirmé le {date} à {heure} au {cabinet}. Pour toute question, appelez le {telephone}.",
  [WhatsappEvent.Reschedule]:
    "Bonjour {prenom}, votre rendez-vous a été déplacé au {date} à {heure} au {cabinet}. Pour toute question, appelez le {telephone}.",
  [WhatsappEvent.Cancellation]:
    "Bonjour {prenom}, votre rendez-vous du {date} à {heure} au {cabinet} a été annulé. Pour reprendre rendez-vous, appelez le {telephone}.",
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
};

export const UNSCHEDULED_LABEL = "Non planifié";

export const UNSCHEDULED_REASON_LABELS: Record<UnscheduledReason, string> = {
  [UnscheduledReason.NoRule]: "aucun message prévu",
  [UnscheduledReason.InvalidPhone]: "numéro invalide",
  [UnscheduledReason.Landline]: "numéro fixe",
  [UnscheduledReason.NoConsent]: "pas de consentement",
};

export const MODE_LABELS: Record<WhatsappMode, string> = {
  [WhatsappMode.Automatic]: "Automatique",
  [WhatsappMode.Sandbox]: "Bac à sable",
  [WhatsappMode.Manual]: "Manuel",
};

export const MODE_DESCRIPTIONS: Record<WhatsappMode, string> = {
  [WhatsappMode.Automatic]:
    "Les messages partent seuls via Twilio, aux heures prévues par les règles.",
  [WhatsappMode.Sandbox]:
    "Les messages partent via le bac à sable Twilio : seuls les numéros qui l’ont rejoint les reçoivent. Pour les tests uniquement.",
  [WhatsappMode.Manual]:
    "Rien ne part seul : la page « Rappels » liste les messages à envoyer et ouvre WhatsApp pour chacun.",
};

export const MODE_TONES: Record<WhatsappMode, StatusTone> = {
  [WhatsappMode.Automatic]: "success",
  [WhatsappMode.Sandbox]: "warning",
  [WhatsappMode.Manual]: "neutral",
};

export const TAB_VALUES = [
  WhatsappTab.Service,
  WhatsappTab.Templates,
  WhatsappTab.Rules,
  WhatsappTab.Journal,
] as const;

export const TAB_LABELS: Record<WhatsappTab, string> = {
  [WhatsappTab.Service]: "État du service",
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

/** The timing units the rule dialog offers, in minutes. */
export const TIMING_UNITS = [
  { value: "minutes", label: "minutes", minutes: 1 },
  { value: "hours", label: "heures", minutes: 60 },
  { value: "days", label: "jours", minutes: 24 * 60 },
] as const;

export type TimingUnit = (typeof TIMING_UNITS)[number]["value"];

/** The env variables «État du service» reports — presence only, never a value. */
export const ENV_CHECKLIST = [
  { key: "TWILIO_ACCOUNT_SID", label: "Identifiant du compte Twilio" },
  { key: "TWILIO_AUTH_TOKEN", label: "Jeton d’authentification Twilio" },
  { key: "TWILIO_WHATSAPP_FROM", label: "Numéro d’envoi WhatsApp" },
  { key: "CRON_SECRET", label: "Secret de la tâche planifiée" },
  { key: "NEXT_PUBLIC_APP_URL", label: "Adresse publique de l’application" },
] as const;

export type EnvKey = (typeof ENV_CHECKLIST)[number]["key"];

// ── Server errors ───────────────────────────────────────────────────────────

export const WHATSAPP_ERRORS = {
  messageNotFound: "Message introuvable.",
  templateNotFound: "Modèle introuvable.",
  ruleNotFound: "Règle introuvable.",
  templateInUse:
    "Ce modèle est utilisé par une règle d’envoi. Supprimez ou modifiez d’abord la règle.",
  templateKindInUse:
    "Ce modèle est utilisé par une règle d’envoi : son événement ne peut plus changer.",
  templateNameTaken: "Un modèle porte déjà ce nom.",
  tooManyReminders: "Trois règles de rappel au maximum.",
  ruleExistsForEvent: "Une règle existe déjà pour cet événement.",
  duplicateReminderOffset: "Une règle de rappel existe déjà avec ce délai.",
  templateInactive: "Ce modèle est désactivé.",
  manualNotAllowed:
    "Ce message ne doit plus être envoyé : le rendez-vous a changé ou a été annulé.",
  consentDeclined: "Le patient a refusé les messages WhatsApp.",
  invalidPhone: "Le numéro du patient n’est pas un mobile valide.",
  retryNotAllowed: "Ce message ne peut pas être renvoyé.",
  clinicPhoneMissing:
    "Renseignez le téléphone du cabinet dans Paramètres › Général avant d’activer les envois.",
  envIncomplete:
    "La configuration Twilio est incomplète : les envois automatiques ne peuvent pas être activés.",
  testFailed: "Le message test n’a pas pu être envoyé.",
  rangeTooLong: "La période ne peut pas dépasser 31 jours.",
  rangeOrder: "La date de fin doit suivre la date de début.",
} as const;

export const WHATSAPP_VALIDATION = {
  nameRequired: "Le nom du modèle est obligatoire",
  nameTooLong: "Le nom du modèle est trop long",
  contentSid: "SID de modèle Twilio invalide (HX suivi de 32 caractères)",
  manualTextRequired: "Le texte du message est obligatoire",
  manualTextTooLong: "Le texte du message est trop long",
  language: "Langue invalide",
  windowFormat: "Heure invalide (HH:MM)",
  windowOrder: "La fin de la plage doit suivre son début",
  minLead: "Le délai minimum doit être compris entre 0 et 1 440 minutes",
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
  today: "Aujourd’hui",
  tomorrow: "Demain",
  dayLabel: "Jour",
  summaryScheduled: "Planifiés",
  summarySent: "Envoyés",
  summaryDelivered: "Délivrés / lus",
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
  retry: "Réessayer",
  next: "Suivant",
  nextNone: "Tous les messages du jour ont été ouverts.",
  opened: "Message ouvert dans WhatsApp",
  retried: "Message replanifié",
  manualBanner:
    "Mode manuel : rien ne part automatiquement. Ouvrez chaque message dans WhatsApp avec « Envoyer sur WhatsApp » ou « Suivant ».",
  sandboxBanner:
    "Mode bac à sable : seuls les numéros qui ont rejoint le bac à sable Twilio reçoivent les messages. Pour les tests uniquement.",
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
  // Settings — service
  serviceMode: "Mode en vigueur",
  connection: "Connexion",
  present: "Configuré",
  missing: "Manquant",
  webhookUrl: "Adresse de retour des statuts (webhook)",
  webhookHelp:
    "Chaque message envoie cette adresse à Twilio : aucune configuration n’est nécessaire dans la console.",
  globalSwitch: "Envois automatiques",
  globalSwitchHelp:
    "Activé : les règles envoient les messages seules. Désactivé : mode manuel.",
  switchDisabledEnv:
    "Complétez la configuration Twilio (variables d’environnement) pour activer les envois.",
  switchDisabledPhone:
    "Renseignez le téléphone du cabinet dans Paramètres › Général pour activer les envois.",
  windowTitle: "Plage d’envoi",
  windowStart: "Début",
  windowEnd: "Fin",
  windowHelp: "Aucun message ne part en dehors de cette plage, à l’heure du cabinet.",
  minLead: "Délai minimum avant le rendez-vous (minutes)",
  minLeadHelp:
    "Un rappel qui ne peut pas partir au moins ce délai avant le rendez-vous est ignoré.",
  saveSettings: "Enregistrer",
  saving: "Enregistrement…",
  settingsSaved: "Paramètres WhatsApp enregistrés",
  lastRun: "Dernier passage de la tâche planifiée",
  lastRunNever: "Jamais",
  lastRunCounts: (claimed: number, sent: number, failed: number, attention: number) =>
    `${claimed} pris en charge · ${sent} envoyés · ${failed} échecs · ${attention} à vérifier`,
  counters24h: "Dernières 24 h",
  counters7d: "7 derniers jours",
  testTitle: "Envoyer un message test",
  testHelp:
    "Envoie le message de l’événement choisi, avec des valeurs d’exemple, au numéro indiqué.",
  testPhone: "Numéro WhatsApp",
  testPhonePlaceholder: "ex. 06 12 34 56 78",
  testEvent: "Événement",
  testSend: "Envoyer le test",
  testSending: "Envoi…",
  testSent: "Message test accepté par Twilio",
  testUnavailable: "Le message test nécessite la configuration Twilio complète.",
  bulkTitle: "Consentement des patients",
  bulkHelp:
    "Marque comme consentants tous les patients dont le consentement n’est pas renseigné.",
  bulkAction: "Marquer tous les patients non renseignés comme consentants",
  bulkConfirmTitle: "Confirmer le consentement ?",
  bulkConfirmDescription:
    "Le cabinet atteste que ces patients ont accepté de recevoir des rappels WhatsApp. Tous les patients « Non renseigné » passeront à « Accepté ». Cette action est enregistrée dans l’activité.",
  bulkDone: (count: number) =>
    count === 0
      ? "Aucun patient à mettre à jour"
      : `${count} patient${count > 1 ? "s" : ""} marqué${count > 1 ? "s" : ""} comme consentant${count > 1 ? "s" : ""}`,
  backfill: "Planifier les rappels des rendez-vous à venir",
  backfillHelp:
    "Crée les rappels manquants pour les rendez-vous futurs (fait automatiquement à l’activation).",
  backfillDone: (count: number) =>
    `${count} rappel${count > 1 ? "s" : ""} planifié${count > 1 ? "s" : ""}`,
  privacyHelp:
    "Twilio et Meta (WhatsApp) traitent le numéro du destinataire et le contenu du message. Les obligations de la loi 09-08 et les déclarations auprès de la CNDP restent à la charge du cabinet.",
  // Settings — templates
  templatesNote:
    "Le texte approuvé se crée et se fait valider sur Twilio / WhatsApp, pas ici. Chaque modèle doit utiliser ces cinq variables, dans cet ordre.",
  newTemplate: "Nouveau modèle",
  editTemplate: "Modifier le modèle",
  templateDialogDescription:
    "Le SID est celui du modèle de contenu approuvé dans la console Twilio.",
  templateName: "Nom",
  templateNamePlaceholder: "ex. Rappel 24 h",
  templateKind: "Événement",
  templateSid: "SID du modèle Twilio",
  templateSidPlaceholder: "ex. HX0123456789abcdef0123456789abcdef",
  templateSidHelp: "Vide : utilisable uniquement en mode manuel et bac à sable.",
  templateLanguage: "Langue",
  templateManualText: "Texte du mode manuel et du bac à sable",
  templateActive: "Actif",
  configured: "Configuré",
  notConfigured: "Non configuré",
  inactive: "Désactivé",
  approvedBody: "Texte à faire approuver",
  copyText: "Copier le texte",
  copied: "Texte copié",
  variables: "Variables",
  insertVariable: "Insérer",
  preview: "Aperçu",
  templateSaved: "Modèle enregistré",
  templateDeleted: "Modèle supprimé",
  deleteTemplate: "Supprimer",
  deleteTemplateTitle: "Supprimer ce modèle ?",
  deleteTemplateDescription:
    "Le modèle sera définitivement supprimé. Les messages déjà envoyés restent dans le journal.",
  templatesEmpty: "Aucun modèle",
  templatesEmptyDescription: "Créez un modèle pour chaque événement à automatiser.",
  edit: "Modifier",
  cancel: "Annuler",
  save: "Enregistrer",
  // Settings — rules
  rulesTitle: "Règles d’envoi automatique",
  rulesAdvice:
    "Évitez les envois tardifs : la plage d’envoi s’applique à toutes les règles. Les modifications et annulations partent immédiatement ; un rappel 24 heures avant le rendez-vous est l’usage le plus courant.",
  addRule: "Ajouter une règle",
  editRule: "Modifier la règle",
  ruleDialogDescription:
    "Le modèle choisi fixe l’événement déclencheur.",
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
  deleteRuleTitle: "Supprimer cette règle ?",
  deleteRuleDescription:
    "Les messages encore planifiés par cette règle seront annulés. Les messages déjà envoyés restent dans le journal.",
  rulesEmpty: "Aucune règle",
  rulesEmptyDescription: "Ajoutez une règle pour automatiser un message.",
  noTemplateAvailable: "Aucun modèle disponible : créez d’abord un modèle.",
  // Settings — journal
  journalFrom: "Du",
  journalTo: "Au",
  allEvents: "Tous les événements",
  allStatuses: "Tous les statuts",
  journalSearch: "Rechercher un patient…",
  journalEmpty: "Aucun message sur cette période.",
  // Shared states
  settingsLoadingTitle: "Chargement de WhatsApp",
  settingsErrorTitle: "WhatsApp indisponible",
  settingsErrorDescription: "Les réglages WhatsApp n’ont pas pu être chargés.",
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
