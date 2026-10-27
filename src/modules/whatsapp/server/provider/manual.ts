import { createTwilioProvider, type TwilioConfig } from "./twilio";
import type { MessagingProvider } from "./types";

/**
 * Manual mode: nothing leaves automatically. Staff open each message in
 * WhatsApp themselves (`wa.me`), so the «provider» refuses every send — a
 * code path that tries to send in manual mode fails loudly, never silently.
 */
export const manualProvider: MessagingProvider = {
  channel: "whatsapp_twilio",
  sandbox: false,
  async send() {
    return {
      ok: false,
      kind: "permanent",
      code: "manual_mode",
      message: "Manual mode: messages are opened by staff, never sent.",
    };
  },
};

/** The provider for the configuration in effect: Twilio, or manual. */
export const providerFor = (twilio: TwilioConfig | null): MessagingProvider =>
  twilio ? createTwilioProvider(twilio) : manualProvider;
