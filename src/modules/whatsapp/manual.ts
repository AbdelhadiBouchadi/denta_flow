import {
  ACTIVE_APPOINTMENT_STATUSES,
  CANCELED_APPOINTMENT_STATUS,
  WHATSAPP_ERRORS,
} from "./constants";
import { toWhatsAppNumber } from "./phone";
import { WhatsappConsent, WhatsappEvent, WhatsappMessageStatus } from "./types";

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
