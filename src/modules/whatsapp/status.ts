import { RETRYABLE_ERROR_CODES } from "./constants";
import { WhatsappMessageStatus as Status } from "./types";

/**
 * Delivery statuses from Twilio's status callbacks (prompts/33, decision 7).
 * Twilio does not promise callback order, so every change is MONOTONIC:
 * an older event arriving late never moves a row backwards.
 */

/** The statuses a callback may move a row to. */
export type CallbackTarget = Status.Sent | Status.Delivered | Status.Read | Status.Failed;

/**
 * Twilio `MessageStatus` → ours. `queued` / `accepted` / `sending` /
 * `scheduled` change nothing: the row is already `sending` or `sent`.
 * `undelivered` and `failed` are both a failure. Anything else — an inbound
 * `received`, an unknown value — is not a status update: `null`.
 */
export const mapTwilioStatus = (twilioStatus: string): CallbackTarget | null => {
  switch (twilioStatus) {
    case "sent":
      return Status.Sent;
    case "delivered":
      return Status.Delivered;
    case "read":
      return Status.Read;
    case "failed":
    case "undelivered":
      return Status.Failed;
    default:
      return null;
  }
};

/**
 * The statuses each target may be reached FROM. `sent → delivered → read`;
 * `failed` is final, and never overrides a `delivered` or `read` (a message
 * read cannot have failed). The webhook's UPDATE puts this list in its WHERE,
 * so the rule holds even for two callbacks processed at once.
 */
export const CALLBACK_PREDECESSORS: Record<CallbackTarget, readonly Status[]> = {
  [Status.Sent]: [Status.Sending],
  [Status.Delivered]: [Status.Sending, Status.Sent],
  [Status.Read]: [Status.Sending, Status.Sent, Status.Delivered],
  [Status.Failed]: [Status.Sending, Status.Sent],
};

/** The row's next status, or `null` when the callback changes nothing. */
export const nextStatusFromCallback = (
  current: Status,
  twilioStatus: string,
): CallbackTarget | null => {
  const target = mapTwilioStatus(twilioStatus);
  if (!target) return null;
  return CALLBACK_PREDECESSORS[target].includes(current) ? target : null;
};

/** «Réessayer» — only where a new attempt can plausibly succeed. */
export const canRetry = (status: Status, errorCode: string | null) =>
  status === Status.NeedsAttention ||
  (status === Status.Failed &&
    errorCode !== null &&
    RETRYABLE_ERROR_CODES.includes(errorCode));
