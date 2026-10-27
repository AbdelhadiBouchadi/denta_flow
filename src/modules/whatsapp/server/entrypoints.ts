import "server-only";

import { db } from "@/database";
import { whatsappSettings } from "@/database/schema";
import { isSendingMode, resolveMode } from "../mode";
import {
  contentApiFor,
  refreshTemplateStatuses,
  submissionAvailability,
  type RefreshSummary,
} from "./approval";
import { runCronTick, type CronSummary } from "./cron";
import { createTwilioProvider } from "./provider/twilio";
import type { MessagingProvider } from "./provider/types";
import {
  readTwilioAuthToken,
  readWhatsappEnv,
  webhookUrl,
} from "./provider/twilio-env";
import { verifyTwilioSignature } from "./signature";
import { processStatusCallback } from "./webhook";

/**
 * What the two route files call — they stay thin (prompts/33, «Server»).
 */

/**
 * The cron's work, or `{ skipped: "manual" }` when nothing may be sent. With
 * a real sender's credentials and the switch off, the tick still refreshes
 * pending template approvals (33b): templates get approved BEFORE the clinic
 * turns automatic sending on.
 */
export const runWhatsappCron = async (
  override?: { provider: MessagingProvider },
): Promise<CronSummary | { skipped: "manual"; approvals?: RefreshSummary }> => {
  const whatsappEnv = readWhatsappEnv();
  const [settings] = await db
    .select({ enabled: whatsappSettings.enabled })
    .from(whatsappSettings)
    .limit(1);

  const mode = resolveMode({
    presence: whatsappEnv.presence,
    from: whatsappEnv.from,
    enabled: settings?.enabled ?? false,
  });
  const contentApi =
    whatsappEnv.twilio && submissionAvailability(whatsappEnv.twilio) === "available"
      ? contentApiFor(whatsappEnv.twilio)
      : null;

  if (!isSendingMode(mode) || (!whatsappEnv.twilio && !override)) {
    if (!contentApi) return { skipped: "manual" };
    const approvals = await refreshTemplateStatuses(contentApi);
    console.info("[whatsapp] cron manual, approvals", JSON.stringify(approvals));
    return { skipped: "manual", approvals };
  }

  const summary = await runCronTick({
    provider: override?.provider ?? createTwilioProvider(whatsappEnv.twilio!),
    statusCallbackUrl: webhookUrl(),
    contentApi,
  });
  // Counts only.
  console.info("[whatsapp] cron", JSON.stringify(summary));
  return summary;
};

/** Verifies and applies one Twilio callback. Returns the HTTP status. */
export const handleTwilioCallback = async ({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string | null;
}): Promise<200 | 401> => {
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const authToken = readTwilioAuthToken();

  if (
    !authToken ||
    !verifyTwilioSignature({ authToken, url: webhookUrl(), params, signature })
  ) {
    return 401;
  }

  const outcome = await processStatusCallback(params);
  // The message id only — never a number, never a text.
  if (outcome === "inbound") {
    console.info("[whatsapp] inbound message ignored");
  } else {
    console.info(`[whatsapp] callback ${params.MessageSid ?? "?"} → ${outcome}`);
  }
  return 200;
};
