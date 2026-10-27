import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. The enums below mirror the slice's pgEnums and are
 * kept in lockstep with `src/database/schema.ts`.
 */
type WhatsappOutputs = inferRouterOutputs<AppRouter>["whatsapp"];

export type WhatsappDay = WhatsappOutputs["getByDay"];
export type WhatsappDayRow = WhatsappDay["items"][number];
export type WhatsappJournal = WhatsappOutputs["getJournal"];
export type WhatsappJournalRow = WhatsappJournal["items"][number];
export type WhatsappServiceStatus = WhatsappOutputs["getServiceStatus"];
export type WhatsappTemplateItem =
  WhatsappOutputs["getTemplates"]["items"][number];
export type WhatsappRuleItem = WhatsappOutputs["listRules"]["items"][number];
export type WhatsappSettingsValues = WhatsappOutputs["getSettings"];
export type WhatsappLatestMessage =
  WhatsappOutputs["getLatestForAppointment"];

/** `whatsapp_event` — what a message is about. */
export enum WhatsappEvent {
  Reminder = "reminder",
  Confirmation = "confirmation",
  Reschedule = "reschedule",
  Cancellation = "cancellation",
}

/** `whatsapp_consent` — only `granted` receives automatic messages. */
export enum WhatsappConsent {
  Granted = "granted",
  Declined = "declined",
  Unknown = "unknown",
}

/** `whatsapp_message_status`. */
export enum WhatsappMessageStatus {
  Scheduled = "scheduled",
  Sending = "sending",
  Sent = "sent",
  Delivered = "delivered",
  Read = "read",
  Failed = "failed",
  Skipped = "skipped",
  Canceled = "canceled",
  NeedsAttention = "needs_attention",
  ManualOpened = "manual_opened",
}

/** `whatsapp_channel`. */
export enum WhatsappChannel {
  Twilio = "whatsapp_twilio",
  ManualLink = "manual_link",
}

/** `whatsapp_skip_reason`. */
export enum WhatsappSkipReason {
  NoConsent = "no_consent",
  InvalidPhone = "invalid_phone",
  Landline = "landline",
  TooLate = "too_late",
  AppointmentStatus = "appointment_status",
  ClinicPhoneMissing = "clinic_phone_missing",
  Superseded = "superseded",
  /** Automatic mode, and the rule's template has no approved version yet. */
  TemplateUnapproved = "template_unapproved",
}

/**
 * A message as the editor holds it: plain text and chips, never a string
 * with placeholders. `template-body.ts` converts it to and from the
 * canonical body sent for approval.
 */
export type BodySegment =
  | { type: "text"; text: string }
  | { type: "chip"; chip: MessageChip };

/** `whatsapp_template_approval` — the state of a template's CURRENT text. */
export enum TemplateApproval {
  Draft = "draft",
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

/**
 * The values a message can carry — the editor's chips. The order is 33's
 * positional order; a template numbers the ones it uses by first appearance.
 */
export enum MessageChip {
  FirstName = "firstName",
  Date = "date",
  Time = "time",
  ClinicName = "clinicName",
  ClinicPhone = "clinicPhone",
}

/**
 * The mode in effect. `automatic` needs the Twilio env AND the global switch;
 * `sandbox` is automatic through Twilio's shared sandbox sender.
 */
export enum WhatsappMode {
  Automatic = "automatic",
  Sandbox = "sandbox",
  Manual = "manual",
}

/** Paramètres › WhatsApp tabs — URL values (`waTab`). `service` is «Connexion». */
export enum WhatsappTab {
  Service = "service",
  Templates = "templates",
  Rules = "rules",
  Journal = "journal",
}

/** `/rappels` status chips — URL values (`status`). */
export enum RappelsFilter {
  All = "all",
  Scheduled = "scheduled",
  Sent = "sent",
  Delivered = "delivered",
  NeedsAttention = "needs_attention",
}

/** Why an appointment of the day has no message row («Non planifié»). */
export enum UnscheduledReason {
  NoRule = "no_rule",
  InvalidPhone = "invalid_phone",
  Landline = "landline",
  NoConsent = "no_consent",
}
