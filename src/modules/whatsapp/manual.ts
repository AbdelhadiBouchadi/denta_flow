import {
  ACTIVE_APPOINTMENT_STATUSES,
  CANCELED_APPOINTMENT_STATUS,
  MANUALLY_FIXABLE_SKIPS,
  WHATSAPP_ERRORS,
} from "./constants";
import { toWhatsAppNumber } from "./phone";
import {
  WhatsappConsent,
  WhatsappEvent,
  WhatsappMessageStatus,
  WhatsappMode,
  type WhatsappSkipReason,
} from "./types";

/**
 * When a message may be opened by hand in WhatsApp (`wa.me`). One rule, read
 * by `getByDay` (to offer the button) and `openManual` (to refuse it): the
 * list and the action can never disagree.
 */

/** Statuses after which the message has gone, or must not go. */
const CLOSED_STATUSES: readonly WhatsappMessageStatus[] = [
  WhatsappMessageStatus.Sending,
  WhatsappMessageStatus.Sent,
  WhatsappMessageStatus.Delivered,
  WhatsappMessageStatus.Read,
  WhatsappMessageStatus.Canceled,
];

export const manualSendRefusal = ({
  event,
  status,
  forStartsAt,
  appointment,
  consent,
  phone,
}: {
  event: WhatsappEvent;
  status: WhatsappMessageStatus;
  forStartsAt: Date;
  appointment: { status: string; startsAt: Date };
  consent: string;
  phone: string;
}): string | null => {
  if (CLOSED_STATUSES.includes(status)) return WHATSAPP_ERRORS.manualNotAllowed;

  const active = (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(
    appointment.status,
  );
  const stillRelevant =
    event === WhatsappEvent.Cancellation
      ? appointment.status === CANCELED_APPOINTMENT_STATUS
      : event === WhatsappEvent.Confirmation
        ? active
        : active && appointment.startsAt.getTime() === forStartsAt.getTime();
  if (!stillRelevant) return WHATSAPP_ERRORS.manualNotAllowed;

  if (consent === WhatsappConsent.Declined) return WHATSAPP_ERRORS.consentDeclined;
  if (!toWhatsAppNumber(phone).ok) return WHATSAPP_ERRORS.invalidPhone;
  return null;
};

/**
 * Whether «Rappels» offers a manual send at all (prompts/33b, decision 1).
 * Manual mode: every message is sent by hand, as in 33. Automatic and
 * sandbox: only a message a person must rescue — failed, to check, or
 * skipped for a reason a human can work around. `manualSendRefusal` still
 * applies on top.
 */
export const manualSendOffered = ({
  mode,
  status,
  skipReason,
}: {
  mode: WhatsappMode;
  status: WhatsappMessageStatus;
  skipReason: string | null;
}) => {
  if (mode === WhatsappMode.Manual) return true;
  if (
    status === WhatsappMessageStatus.Failed ||
    status === WhatsappMessageStatus.NeedsAttention
  ) {
    return true;
  }
  return (
    status === WhatsappMessageStatus.Skipped &&
    skipReason !== null &&
    MANUALLY_FIXABLE_SKIPS.includes(skipReason as WhatsappSkipReason)
  );
};
