import type { MessageParams } from "../../message";
import type { MessageChip } from "../../types";

/**
 * The sending layer (prompts/33, decision 9). Rules, rows, the cron and the
 * UI only ever see this interface: another channel (SMS, Meta Cloud API) is
 * one more adapter, with no change anywhere else.
 */
export interface SendInput {
  /** Recipient digits, country code first, no «+» — `toWhatsAppNumber`'s output. */
  to: string;
  /** The template's CURRENT values, read at send time. */
  template: SendTemplate;
  params: MessageParams;
  /** Where the provider reports delivery; `null` when no public URL is set. */
  statusCallbackUrl: string | null;
}

/**
 * What one message is sent with. Outside the sandbox: the APPROVED resource
 * and the variable order it was approved with. In the sandbox: the current
 * text, rendered (no approval exists there).
 */
export interface SendTemplate {
  contentSid: string | null;
  contentVariables: MessageChip[] | null;
  body: string;
  variables: MessageChip[];
}

export type SendFailureKind =
  /** Refused for good (invalid number, unapproved template…): never resent. */
  | "permanent"
  /** Clearly NOT accepted (5xx, 429, connection refused): safe to retry. */
  | "transient"
  /** Maybe accepted (timeout after the request left): never resent. */
  | "ambiguous";

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; kind: SendFailureKind; code: string; message: string };

export interface MessagingProvider {
  /** Recorded on the row as its channel. */
  readonly channel: "whatsapp_twilio";
  /** Twilio's shared sandbox sender: slower pacing, manual text as Body. */
  readonly sandbox: boolean;
  send(input: SendInput): Promise<SendResult>;
}
