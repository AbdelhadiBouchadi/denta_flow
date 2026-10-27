import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/database";
import { whatsappMessages } from "@/database/schema";
import { CALLBACK_PREDECESSORS, mapTwilioStatus } from "../status";
import { WhatsappMessageStatus } from "../types";

/**
 * Twilio's status callback, once its signature is verified (prompts/33,
 * decision 10). Idempotent and monotonic: the UPDATE only lands while the
 * row is in a status the target may follow (`CALLBACK_PREDECESSORS`), so a
 * duplicate or an out-of-order older event matches nothing.
 */
export type CallbackOutcome =
  | "inbound"
  | "ignored"
  | "unknown_message"
  | "unchanged"
  | "updated";

export const processStatusCallback = async (
  params: Record<string, string>,
  now: Date = new Date(),
): Promise<CallbackOutcome> => {
  const twilioStatus = params.MessageStatus ?? params.SmsStatus ?? "";
  // An incoming WhatsApp message (a patient replying) — not handled here.
  if (twilioStatus === "received" || twilioStatus === "receiving") return "inbound";
  if (!params.MessageStatus && params.Body !== undefined) return "inbound";

  const sid = params.MessageSid ?? params.SmsSid;
  const target = mapTwilioStatus(twilioStatus);
  if (!sid || !target) return "ignored";

  const stamp =
    target === WhatsappMessageStatus.Delivered
      ? { deliveredAt: now }
      : target === WhatsappMessageStatus.Read
        ? { readAt: now }
        : target === WhatsappMessageStatus.Failed
          ? {
              failedAt: now,
              errorCode: params.ErrorCode || null,
              errorMessage: params.ChannelStatusMessage?.slice(0, 500) || null,
            }
          : {};

  const updated = await db
    .update(whatsappMessages)
    .set({ status: target, ...stamp, updatedAt: now })
    .where(
      and(
        eq(whatsappMessages.providerMessageId, sid),
        inArray(whatsappMessages.status, [...CALLBACK_PREDECESSORS[target]]),
      ),
    )
    .returning({ id: whatsappMessages.id });

  if (updated.length > 0) return "updated";

  const [known] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.providerMessageId, sid))
    .limit(1);
  return known ? "unchanged" : "unknown_message";
};
