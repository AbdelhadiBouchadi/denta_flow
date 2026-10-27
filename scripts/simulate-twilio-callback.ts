// scripts/simulate-twilio-callback.ts   —   DEV ONLY
//
//   npx tsx scripts/simulate-twilio-callback.ts <MessageSid> <status> [ErrorCode]
//
// Posts a CORRECTLY SIGNED Twilio status callback for one message to the
// local app's webhook, so the delivery flow (sent → delivered → read, or
// failed) can be driven without Twilio. <status> is a Twilio MessageStatus:
// queued, sent, delivered, read, failed, undelivered.
//
// The signature is computed exactly as Twilio does (src/modules/whatsapp/
// server/signature.ts) over the URL the app validates against:
// NEXT_PUBLIC_APP_URL + /api/webhooks/whatsapp, keyed with TWILIO_AUTH_TOKEN.
// Prints ids and HTTP statuses only.
import "dotenv/config";

import { computeTwilioSignature } from "../src/modules/whatsapp/server/signature";

const STATUSES = ["queued", "sent", "delivered", "read", "failed", "undelivered"];

const main = async () => {
  const [messageSid, status, errorCode] = process.argv.slice(2);
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev only: refuses to run with NODE_ENV=production.");
  }
  if (!messageSid || !status || !STATUSES.includes(status)) {
    throw new Error(
      `Usage: npx tsx scripts/simulate-twilio-callback.ts <MessageSid> <${STATUSES.join("|")}> [ErrorCode]`,
    );
  }
  if (!authToken || !appUrl) {
    throw new Error("TWILIO_AUTH_TOKEN and NEXT_PUBLIC_APP_URL must be set.");
  }

  const url = `${appUrl.replace(/\/+$/, "")}/api/webhooks/whatsapp`;
  const params: Record<string, string> = {
    AccountSid: process.env.TWILIO_ACCOUNT_SID ?? "ACsimulated",
    MessageSid: messageSid,
    SmsSid: messageSid,
    MessageStatus: status,
    SmsStatus: status,
    ChannelPrefix: "whatsapp",
    ...(errorCode ? { ErrorCode: errorCode } : {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": computeTwilioSignature(authToken, url, params),
    },
    body: new URLSearchParams(params).toString(),
  });

  console.log(`${messageSid} ${status} → HTTP ${response.status}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
