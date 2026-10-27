import "server-only";

import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/database";
import {
  appointments,
  clinicSettings,
  patients,
  whatsappMessages,
  whatsappRules,
  whatsappSettings,
  whatsappTemplates,
} from "@/database/schema";
import {
  APPROVAL_REFRESH_MIN_BUDGET_MS,
  CLAIM_LIMIT,
  CRON_MAX_DURATION_SECONDS,
  CRON_SAFETY_MARGIN_MS,
  MAX_SEND_ATTEMPTS,
  SANDBOX_CLAIM_LIMIT,
  SANDBOX_SEND_SPACING_MS,
  SEND_SPACING_MS,
  STALE_SENDING_MINUTES,
  TRANSIENT_RETRY_MINUTES,
} from "../constants";
import { checkClaimedRow } from "../send-check";
import { WhatsappEvent, type MessageChip } from "../types";
import { refreshTemplateStatuses, type RefreshSummary } from "./approval";
import type { ContentApi } from "./provider/twilio-content";
import type { MessagingProvider, SendResult } from "./provider/types";
import { toSendWindow } from "./scheduling";

/**
 * One cron tick (prompts/33, decision 8). Never sends twice:
 *
 * 1. rows stuck in `sending` for 10 minutes become `needs_attention` — Twilio
 *    has no idempotency key, so a resend could duplicate a message;
 * 2. due rows are CLAIMED by one atomic UPDATE … WHERE id IN (SELECT … FOR
 *    UPDATE SKIP LOCKED) — two overlapping ticks can never claim the same row;
 * 3. each claimed row is re-validated (`checkClaimedRow`) and sent, skipped,
 *    canceled or rescheduled; every outcome write is guarded on `sending`.
 *
 * prompts/33b adds two steps around those, nothing inside them:
 *
 * - before claiming (automatic mode only), due rows whose rule's template
 *   has no APPROVED version become `needs_attention` / `template_unapproved`
 *   — never sent to fail at Twilio;
 * - after sending, if time is left, the `pending` templates' approval status
 *   is refreshed — at most 10 per tick.
 *
 * Logs counts and message ids only — never a number or a message text.
 */

const MINUTE_MS = 60_000;

export interface CronDeps {
  provider: MessagingProvider;
  statusCallbackUrl: string | null;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Defaults to the route's `maxDuration` minus a safety margin. */
  budgetMs?: number;
  /** Real sender only: refreshes pending template approvals after sending. */
  contentApi?: ContentApi | null;
}

export interface CronSummary {
  claimed: number;
  sent: number;
  failed: number;
  needsAttention: number;
  skipped: number;
  canceled: number;
  rescheduled: number;
  released: number;
  /** Due rows held back: their template is not approved yet. */
  templateUnapproved: number;
  /** The approval refresh, or `null` when it did not run. */
  approvals: RefreshSummary | null;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const isSending = (id: string) =>
  and(eq(whatsappMessages.id, id), eq(whatsappMessages.status, "sending"));

/** Step 1 — stale `sending` rows. Returns how many were flagged. */
export const flagStaleSending = async (now: Date) => {
  const flagged = await db
    .update(whatsappMessages)
    .set({ status: "needs_attention", updatedAt: now })
    .where(
      and(
        eq(whatsappMessages.status, "sending"),
        lte(
          whatsappMessages.claimedAt,
          new Date(now.getTime() - STALE_SENDING_MINUTES * MINUTE_MS),
        ),
      ),
    )
    .returning({ id: whatsappMessages.id });
  return flagged.length;
};

/**
 * Step 1b (33b, automatic mode) — due rows of an enabled rule whose active
 * template has no approved resource: `needs_attention`, reason
 * `template_unapproved`, for «Rappels» to show. One statement, before the
 * claim, so they are never claimed. A disabled rule or template is left to
 * the send-time check, which cancels its rows.
 */
export const flagUnapprovedDue = async (now: Date) => {
  const unapprovedRules = db
    .select({ id: whatsappRules.id })
    .from(whatsappRules)
    .innerJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id))
    .where(
      and(
        eq(whatsappRules.enabled, true),
        eq(whatsappTemplates.isActive, true),
        isNull(whatsappTemplates.activeContentSid),
      ),
    );
  const flagged = await db
    .update(whatsappMessages)
    .set({ status: "needs_attention", skipReason: "template_unapproved", updatedAt: now })
    .where(
      and(
        eq(whatsappMessages.status, "scheduled"),
        lte(whatsappMessages.scheduledFor, now),
        inArray(whatsappMessages.ruleId, unapprovedRules),
      ),
    )
    .returning({ id: whatsappMessages.id });
  return flagged.length;
};

/** Step 2 — the atomic claim. One statement, works over Neon HTTP. */
export const claimDueRows = async (now: Date, limit: number) => {
  const due = db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.status, "scheduled"),
        lte(whatsappMessages.scheduledFor, now),
      ),
    )
    .orderBy(asc(whatsappMessages.scheduledFor), asc(whatsappMessages.id))
    .limit(limit)
    .for("update", { skipLocked: true });

  return db
    .update(whatsappMessages)
    .set({ status: "sending", claimedAt: now, updatedAt: now })
    // `status = 'scheduled'` again: re-checked on the locked row.
    .where(
      and(
        inArray(whatsappMessages.id, due),
        eq(whatsappMessages.status, "scheduled"),
      ),
    )
    .returning({ id: whatsappMessages.id });
};

/** Everything the send-time check reads, for the claimed rows, in one query. */
const loadClaimed = (ids: string[]) =>
  db
    .select({
      id: whatsappMessages.id,
      event: whatsappMessages.event,
      forStartsAt: whatsappMessages.forStartsAt,
      attempts: whatsappMessages.attempts,
      appointment: {
        status: appointments.status,
        startsAt: appointments.startsAt,
      },
      patient: {
        firstName: patients.firstName,
        phone: patients.phone,
        consent: patients.whatsappConsent,
      },
      ruleEnabled: whatsappRules.enabled,
      ruleId: whatsappRules.id,
      template: {
        id: whatsappTemplates.id,
        activeContentSid: whatsappTemplates.activeContentSid,
        activeVariables: whatsappTemplates.activeVariables,
        body: whatsappTemplates.body,
        variables: whatsappTemplates.variables,
        isActive: whatsappTemplates.isActive,
      },
    })
    .from(whatsappMessages)
    .innerJoin(appointments, eq(whatsappMessages.appointmentId, appointments.id))
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(whatsappRules, eq(whatsappMessages.ruleId, whatsappRules.id))
    .leftJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id))
    .where(inArray(whatsappMessages.id, ids))
    .orderBy(asc(whatsappMessages.scheduledFor), asc(whatsappMessages.id));

/** Step 3's write for a provider answer. */
const recordResult = async (
  id: string,
  attempts: number,
  result: SendResult,
  now: Date,
  channel: "whatsapp_twilio",
) => {
  const attempt = attempts + 1;
  if (result.ok) {
    await db
      .update(whatsappMessages)
      .set({
        status: "sent",
        providerMessageId: result.messageId,
        channel,
        attempts: attempt,
        sentAt: now,
        errorCode: null,
        errorMessage: null,
        updatedAt: now,
      })
      .where(isSending(id));
    return "sent" as const;
  }

  const error = {
    attempts: attempt,
    channel,
    errorCode: result.code,
    // Twilio's own text, never ours; truncated for the tooltip.
    errorMessage: result.message.slice(0, 500),
    updatedAt: now,
  };

  if (result.kind === "permanent") {
    await db
      .update(whatsappMessages)
      .set({ ...error, status: "failed", failedAt: now })
      .where(isSending(id));
    return "failed" as const;
  }

  if (result.kind === "transient" && attempt < MAX_SEND_ATTEMPTS) {
    await db
      .update(whatsappMessages)
      .set({
        ...error,
        status: "scheduled",
        scheduledFor: new Date(now.getTime() + TRANSIENT_RETRY_MINUTES * MINUTE_MS),
      })
      .where(isSending(id));
    return "rescheduled" as const;
  }

  // Ambiguous, or transient for the third time: a human decides.
  await db
    .update(whatsappMessages)
    .set({ ...error, status: "needs_attention" })
    .where(isSending(id));
  return "needs_attention" as const;
};

export const runCronTick = async (deps: CronDeps): Promise<CronSummary> => {
  const clock = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const startedAt = clock().getTime();
  const budgetMs =
    deps.budgetMs ?? CRON_MAX_DURATION_SECONDS * 1000 - CRON_SAFETY_MARGIN_MS;
  const spacing = deps.provider.sandbox ? SANDBOX_SEND_SPACING_MS : SEND_SPACING_MS;

  const summary: CronSummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    needsAttention: 0,
    skipped: 0,
    canceled: 0,
    rescheduled: 0,
    released: 0,
    templateUnapproved: 0,
    approvals: null,
  };

  summary.needsAttention += await flagStaleSending(clock());
  if (!deps.provider.sandbox) {
    summary.templateUnapproved = await flagUnapprovedDue(clock());
  }

  const claimed = await claimDueRows(
    clock(),
    deps.provider.sandbox ? SANDBOX_CLAIM_LIMIT : CLAIM_LIMIT,
  );
  summary.claimed = claimed.length;

  if (claimed.length > 0) {
    const [ordered, [settings], [clinic]] = await Promise.all([
      loadClaimed(claimed.map((row) => row.id)),
      db.select().from(whatsappSettings).limit(1),
      db
        .select({ name: clinicSettings.name, phone: clinicSettings.phone })
        .from(clinicSettings)
        .limit(1),
    ]);
    const window = toSendWindow(settings);

    const evaluate = (row: (typeof ordered)[number]) =>
      checkClaimedRow({
        event: row.event as WhatsappEvent,
        forStartsAt: row.forStartsAt,
        appointment: row.appointment,
        patient: row.patient,
        clinic: { name: clinic?.name ?? "", phone: clinic?.phone ?? null },
        rule: row.ruleId ? { enabled: !!row.ruleEnabled } : null,
        template: row.template?.id
          ? {
              activeContentSid: row.template.activeContentSid,
              activeVariables: row.template.activeVariables as MessageChip[] | null,
              body: row.template.body!,
              variables: row.template.variables as MessageChip[],
              isActive: !!row.template.isActive,
            }
          : null,
        sandbox: deps.provider.sandbox,
        window,
        now: clock(),
      });

    let sentOnce = false;
    for (const loaded of ordered) {
      // Out of time: give the rest back, untouched, for the next tick.
      if (clock().getTime() - startedAt > budgetMs) {
        await db
          .update(whatsappMessages)
          .set({ status: "scheduled", updatedAt: clock() })
          .where(isSending(loaded.id));
        summary.released++;
        continue;
      }

      let row = loaded;
      let check = evaluate(row);
      if (check.action === "send") {
        if (sentOnce) await sleep(spacing);
        // Read again right before the send: an appointment canceled or moved
        // since the claim (or during the spacing) must not get its message.
        const [fresh] = await loadClaimed([row.id]);
        if (!fresh) continue;
        row = fresh;
        check = evaluate(row);
      }
      const now = clock();

      switch (check.action) {
        case "cancel":
          await db
            .update(whatsappMessages)
            .set({ status: "canceled", skipReason: check.reason, updatedAt: now })
            .where(isSending(row.id));
          summary.canceled++;
          break;
        case "attention":
          await db
            .update(whatsappMessages)
            .set({ status: "needs_attention", skipReason: check.reason, updatedAt: now })
            .where(isSending(row.id));
          summary.templateUnapproved++;
          break;
        case "skip":
          await db
            .update(whatsappMessages)
            .set({ status: "skipped", skipReason: check.reason, updatedAt: now })
            .where(isSending(row.id));
          summary.skipped++;
          break;
        case "reschedule":
          await db
            .update(whatsappMessages)
            .set({ status: "scheduled", scheduledFor: check.at, updatedAt: now })
            .where(isSending(row.id));
          summary.rescheduled++;
          break;
        case "send": {
          sentOnce = true;
          const result = await deps.provider.send({
            to: check.to,
            template: check.template,
            params: check.params,
            statusCallbackUrl: deps.statusCallbackUrl,
          });
          const outcome = await recordResult(
            row.id,
            row.attempts,
            result,
            clock(),
            deps.provider.channel,
          );
          if (outcome === "sent") summary.sent++;
          else if (outcome === "failed") summary.failed++;
          else if (outcome === "needs_attention") summary.needsAttention++;
          else summary.rescheduled++;
          // Ids only.
          console.info(
            `[whatsapp] ${row.id} → ${outcome}${result.ok ? ` (${result.messageId})` : ` (${result.code})`}`,
          );
          break;
        }
      }
    }
  }

  // After sending, never before: approvals wait, patients do not.
  if (
    deps.contentApi &&
    budgetMs - (clock().getTime() - startedAt) >= APPROVAL_REFRESH_MIN_BUDGET_MS
  ) {
    summary.approvals = await refreshTemplateStatuses(deps.contentApi, { now: clock() });
  }

  await db
    .update(whatsappSettings)
    .set({
      lastCronAt: clock(),
      lastCronClaimed: summary.claimed,
      lastCronSent: summary.sent,
      lastCronFailed: summary.failed,
      lastCronNeedsAttention: summary.needsAttention,
    })
    .where(sql`true`);

  return summary;
};
