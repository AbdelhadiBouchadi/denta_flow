import "server-only";

import { env } from "@/lib/env";
import { isEnvComplete, isSandboxSender, type EnvPresence } from "../../mode";
import type { TwilioConfig } from "./twilio";

/**
 * The ONE reader of the Twilio credentials. Nothing it returns ever reaches a
 * client: procedures expose `presence` (booleans) only.
 */
export const readWhatsappEnv = () => {
  const presence: EnvPresence = {
    TWILIO_ACCOUNT_SID: !!env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: !!env.TWILIO_WHATSAPP_FROM,
    CRON_SECRET: !!env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: !!env.NEXT_PUBLIC_APP_URL,
  };

  const twilio: TwilioConfig | null =
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM
      ? {
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: env.TWILIO_WHATSAPP_FROM,
          sandbox: isSandboxSender(env.TWILIO_WHATSAPP_FROM),
        }
      : null;

  return {
    presence,
    complete: isEnvComplete(presence),
    from: env.TWILIO_WHATSAPP_FROM ?? null,
    twilio,
  };
};

/** The webhook's HMAC key. */
export const readTwilioAuthToken = () => env.TWILIO_AUTH_TOKEN ?? null;

/**
 * The public URL Twilio calls back — built from `NEXT_PUBLIC_APP_URL`, the
 * repo's public origin. Signature validation hashes this exact string, so it
 * must equal what Twilio called (scheme, host, port, path, no trailing slash).
 */
export const webhookUrl = () =>
  `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/whatsapp`;
