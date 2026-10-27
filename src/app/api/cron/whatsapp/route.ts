import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { runWhatsappCron } from "@/modules/whatsapp/server/entrypoints";
import { verifyBearer } from "@/modules/whatsapp/server/signature";

/**
 * GET /api/cron/whatsapp — Vercel Cron, every 5 minutes (vercel.json).
 * Authenticates ITSELF: `Authorization: Bearer ${CRON_SECRET}`, compared in
 * constant time. proxy.ts lets this path through and nothing else.
 */

export const runtime = "nodejs";
// A literal: the build reads it statically. Matches CRON_MAX_DURATION_SECONDS.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyBearer(request.headers.get("authorization"), env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }

  const result = await runWhatsappCron();
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
