import { isTemplateSendable } from "./approval";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  CANCELED_APPOINTMENT_STATUS,
} from "./constants";
import { buildMessageParams, type MessageParams } from "./message";
import { toWhatsAppNumber } from "./phone";
import { decideAtSendTime, type SendWindow } from "./schedule";
import type { SendTemplate } from "./server/provider/types";
import {
  WhatsappConsent,
  WhatsappEvent,
  WhatsappSkipReason,
  type MessageChip,
} from "./types";

/**
 * The send-time check — THE authority (prompts/33, decision 6). Whatever the
 * row says, the cron re-reads the appointment, the patient, the rule and the
 * clinic, and only sends if every condition still holds now. Pure.
 */

export interface ClaimedRow {
  event: WhatsappEvent;
  forStartsAt: Date;
  appointment: { status: string; startsAt: Date };
  patient: { firstName: string; phone: string; consent: string };
  clinic: { name: string; phone: string | null };
  /** `null` when the rule was deleted. */
  rule: { enabled: boolean } | null;
  template: {
    activeContentSid: string | null;
    activeVariables: MessageChip[] | null;
    body: string;
    variables: MessageChip[];
    isActive: boolean;
  } | null;
  /** Twilio's shared sandbox: the text goes as is, no approval needed. */
  sandbox: boolean;
  window: SendWindow;
  now: Date;
}

export type SendCheck =
  | {
      action: "send";
      to: string;
      params: MessageParams;
      template: SendTemplate;
    }
  | { action: "cancel"; reason: WhatsappSkipReason }
  /** A person must act (prompts/33b): the row becomes `needs_attention`. */
  | { action: "attention"; reason: WhatsappSkipReason }
  | { action: "skip"; reason: WhatsappSkipReason }
  | { action: "reschedule"; at: Date };

const isActive = (status: string) =>
  (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);

/** The appointment no longer calls for this message. */
const appointmentMismatch = (row: ClaimedRow): WhatsappSkipReason | null => {
  const { status, startsAt } = row.appointment;
  switch (row.event) {
    case WhatsappEvent.Reminder:
    case WhatsappEvent.Reschedule:
      if (!isActive(status)) return WhatsappSkipReason.AppointmentStatus;
      return startsAt.getTime() === row.forStartsAt.getTime()
        ? null
        : WhatsappSkipReason.Superseded;
    case WhatsappEvent.Confirmation:
      return isActive(status) ? null : WhatsappSkipReason.AppointmentStatus;
    case WhatsappEvent.Cancellation:
      return status === CANCELED_APPOINTMENT_STATUS
        ? null
        : WhatsappSkipReason.AppointmentStatus;
  }
};

export const checkClaimedRow = (row: ClaimedRow): SendCheck => {
  if (!row.rule || !row.rule.enabled || !row.template || !row.template.isActive) {
    return { action: "cancel", reason: WhatsappSkipReason.Superseded };
  }

  const mismatch = appointmentMismatch(row);
  if (mismatch) return { action: "cancel", reason: mismatch };

  // Automatic mode sends only an approved resource — never fails at Twilio
  // for an unapproved one. Approval later, then «Réessayer», sends it.
  if (!isTemplateSendable(row.template, row.sandbox)) {
    return { action: "attention", reason: WhatsappSkipReason.TemplateUnapproved };
  }

  if (row.patient.consent !== WhatsappConsent.Granted) {
    return { action: "skip", reason: WhatsappSkipReason.NoConsent };
  }

  const number = toWhatsAppNumber(row.patient.phone);
  if (!number.ok) {
    return {
      action: "skip",
      reason:
        number.reason === "fixe"
          ? WhatsappSkipReason.Landline
          : WhatsappSkipReason.InvalidPhone,
    };
  }

  if (!row.clinic.phone?.trim()) {
    return { action: "skip", reason: WhatsappSkipReason.ClinicPhoneMissing };
  }

  // Variables describe the slot the message is ABOUT: the canceled slot for
  // a cancellation, the new slot for a reschedule — `forStartsAt` both times.
  const decision = decideAtSendTime({
    event: row.event,
    startsAt: row.forStartsAt,
    now: row.now,
    settings: row.window,
  });
  if ("skip" in decision) return { action: "skip", reason: decision.skip };
  if ("reschedule" in decision) return { action: "reschedule", at: decision.reschedule };

  return {
    action: "send",
    to: number.digits,
    template: {
      contentSid: row.sandbox ? null : row.template.activeContentSid,
      contentVariables: row.sandbox ? null : row.template.activeVariables,
      body: row.template.body,
      variables: row.template.variables,
    },
    params: buildMessageParams({
      firstName: row.patient.firstName,
      startsAt: row.forStartsAt,
      clinicName: row.clinic.name,
      clinicPhone: row.clinic.phone,
    }),
  };
};
