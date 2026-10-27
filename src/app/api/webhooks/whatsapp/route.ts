import type { NextRequest } from "next/server";

import { handleTwilioCallback } from "@/modules/whatsapp/server/entrypoints";

/**
 * POST /api/webhooks/whatsapp — Twilio's status callbacks. Authenticates
 * ITSELF through `X-Twilio-Signature`; proxy.ts lets this path through and
 * nothing else. Answers 200 with an empty body as soon as the row is updated.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const status = await handleTwilioCallback({
    rawBody: await request.text(),
    signature: request.headers.get("x-twilio-signature"),
  });
  return new Response(null, { status });
}
