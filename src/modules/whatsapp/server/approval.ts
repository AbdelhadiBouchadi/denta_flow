import "server-only";

import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { db } from "@/database";
import { clinicSettings, whatsappTemplates } from "@/database/schema";
import { env } from "@/lib/env";
import {
  buildApprovalName,
  claimPatch,
  isSubmittable,
  resultPatch,
} from "../approval";
import {
  APPROVAL_REFRESH_LIMIT,
  APPROVAL_STUCK_MINUTES,
  CHIP_SAMPLES,
} from "../constants";
import { formatClinicPhone } from "../message";
import {
  APPROVAL_NAME_SUFFIX_LENGTH,
  CONTENT_APPROVAL_CATEGORY,
  CONTENT_LANGUAGE,
} from "../provider-constants";
import { contentVariablesFor } from "../template-body";
import { MessageChip, TemplateApproval, type WhatsappEvent } from "../types";
import type { TwilioConfig } from "./provider/twilio";
import {
  createTwilioContentApi,
  type ContentApi,
  type ContentFailure,
} from "./provider/twilio-content";
import { readWhatsappEnv } from "./provider/twilio-env";

/**
 * Templates submitted for WhatsApp approval from the app (prompts/33b,
 * decision 6). The pure lifecycle is `../approval.ts`; this file applies it,
 * every write guarded in SQL so two clicks, two tabs or a cron tick running
 * alongside can never create two resources or overwrite a newer edit.
 */

const MINUTE_MS = 60_000;
const UNIQUE_VIOLATION = "23505";

const suffix = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  APPROVAL_NAME_SUFFIX_LENGTH,
);

// ── Which API, and may we use it ────────────────────────────────────────────

let override: ContentApi | null = null;

/** Fixture runs swap in the fake. Refused in production. */
export const setContentApiForTesting = (api: ContentApi | null) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The Content API override is for tests only.");
  }
  override = api;
};

export const contentApiFor = (twilio: TwilioConfig) =>
  override ?? createTwilioContentApi(twilio);

export type SubmissionAvailability = "available" | "sandbox" | "unavailable";

/**
 * Templates can be submitted with a real sender's credentials — whatever the
 * global switch says, so they are approved BEFORE automatic sending starts.
 * The shared sandbox has no templates: never a Content API call there.
 */
export const submissionAvailability = (
  twilio: TwilioConfig | null = readWhatsappEnv().twilio,
): SubmissionAvailability =>
  !twilio ? "unavailable" : twilio.sandbox ? "sandbox" : "available";

// ── Submit ──────────────────────────────────────────────────────────────────

export type SubmitOutcome =
  | { submitted: true; status: TemplateApproval.Pending }
  | { submitted: false; status: TemplateApproval }
  | { submitted: false; failure: ContentFailure };

const errorCode = (error: unknown) =>
  (error as { code?: unknown; cause?: { code?: unknown } } | null)?.code ??
  (error as { cause?: { code?: unknown } } | null)?.cause?.code;

/** The clinic's real name and phone are the reviewers' examples. */
const sampleValues = async () => {
  const [clinic] = await db
    .select({ name: clinicSettings.name, phone: clinicSettings.phone })
    .from(clinicSettings)
    .limit(1);
  return {
    ...CHIP_SAMPLES,
    [MessageChip.ClinicName]:
      clinic?.name?.trim() || env.NEXT_PUBLIC_CLINIC_NAME || CHIP_SAMPLES[MessageChip.ClinicName],
    [MessageChip.ClinicPhone]: clinic?.phone?.trim()
      ? formatClinicPhone(clinic.phone)
      : CHIP_SAMPLES[MessageChip.ClinicPhone],
  };
};

/**
 * Creates the Content resource and asks WhatsApp to approve it — once.
 *
 * 1. the row is CLAIMED `pending` by one UPDATE guarded on its status and
 *    its text: a second click, or a save in between, claims nothing and
 *    gets the current status back — no second resource;
 * 2. the resource is created, its SID stored (guarded on the claim's name);
 * 3. the approval request is sent.
 *
 * A provider failure puts the row back where it was and deletes a resource
 * created for nothing. A crash between 1 and 2 is healed by the refresh
 * (`APPROVAL_STUCK_MINUTES`).
 */
export const submitTemplateForApproval = async (
  templateId: string,
  api: ContentApi,
  now = new Date(),
): Promise<SubmitOutcome> => {
  const [template] = await db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.id, templateId))
    .limit(1);
  if (!template) return { submitted: false, status: TemplateApproval.Draft };

  const status = template.approvalStatus as TemplateApproval;
  if (!isSubmittable(status)) return { submitted: false, status };

  const variables = template.variables as MessageChip[];
  let approvalName = "";
  let claimed = false;
  for (let attempt = 0; attempt < 3 && !claimed; attempt++) {
    approvalName = buildApprovalName(template.kind as WhatsappEvent, template.name, suffix());
    try {
      const rows = await db
        .update(whatsappTemplates)
        .set({ ...claimPatch(variables, approvalName, now), updatedAt: now })
        .where(
          and(
            eq(whatsappTemplates.id, template.id),
            eq(whatsappTemplates.approvalStatus, status),
            // The text read above is still the text: an edit meanwhile wins.
            // (Not `updated_at`: Postgres keeps microseconds, a JS Date does not.)
            eq(whatsappTemplates.body, template.body),
            sql`${whatsappTemplates.variables} = ${JSON.stringify(variables)}::jsonb`,
          ),
        )
        .returning({ id: whatsappTemplates.id });
      if (rows.length === 0) {
        // Someone else submitted or edited meanwhile: report what is there now.
        const [current] = await db
          .select({ status: whatsappTemplates.approvalStatus })
          .from(whatsappTemplates)
          .where(eq(whatsappTemplates.id, template.id));
        return { submitted: false, status: (current?.status ?? status) as TemplateApproval };
      }
      claimed = true;
    } catch (error) {
      // The random suffix collided with an earlier submission: draw again.
      if (errorCode(error) !== UNIQUE_VIOLATION) throw error;
    }
  }
  if (!claimed) {
    return { submitted: false, failure: { ok: false, code: "name_collision", message: approvalName } };
  }

  const claim = and(
    eq(whatsappTemplates.id, template.id),
    eq(whatsappTemplates.approvalStatus, TemplateApproval.Pending),
    eq(whatsappTemplates.approvalName, approvalName),
  );
  const release = (sid: string | null) =>
    db
      .update(whatsappTemplates)
      .set({
        approvalStatus: status,
        rejectionReason: template.rejectionReason,
        pendingContentSid: null,
        pendingVariables: null,
        submittedAt: template.submittedAt,
        updatedAt: new Date(),
      })
      .where(and(claim, sid ? eq(whatsappTemplates.pendingContentSid, sid) : isNull(whatsappTemplates.pendingContentSid)));

  const created = await api.create({
    friendlyName: approvalName,
    language: CONTENT_LANGUAGE,
    body: template.body,
    variables: contentVariablesFor(variables, await sampleValues()),
  });
  if (!created.ok) {
    await release(null);
    return { submitted: false, failure: created };
  }

  const stored = await db
    .update(whatsappTemplates)
    .set({ pendingContentSid: created.sid })
    .where(and(claim, isNull(whatsappTemplates.pendingContentSid)))
    .returning({ id: whatsappTemplates.id });
  if (stored.length === 0) {
    // Edited while the resource was being created: it describes nothing now.
    await api.remove(created.sid);
    const [current] = await db
      .select({ status: whatsappTemplates.approvalStatus })
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, template.id));
    return { submitted: false, status: (current?.status ?? status) as TemplateApproval };
  }

  const requested = await api.submitForWhatsapp(created.sid, {
    name: approvalName,
    category: CONTENT_APPROVAL_CATEGORY,
  });
  if (!requested.ok) {
    await release(created.sid);
    await api.remove(created.sid);
    return { submitted: false, failure: requested };
  }

  return { submitted: true, status: TemplateApproval.Pending };
};

// ── Refresh ─────────────────────────────────────────────────────────────────

export interface RefreshSummary {
  checked: number;
  approved: number;
  rejected: number;
  errors: number;
  released: number;
}

/**
 * Reads the verdict of the `pending` templates — at most `limit` (10), the
 * least recently checked first, so a long queue is visited in turn across
 * ticks. Approval promotes the pending resource; rejection keeps the active
 * one. Each write is guarded on the SID it read: an edit made meanwhile wins.
 * Also returns to draft a claim whose resource never got created.
 */
export const refreshTemplateStatuses = async (
  api: ContentApi,
  { now = new Date(), limit = APPROVAL_REFRESH_LIMIT, ids }: { now?: Date; limit?: number; ids?: string[] } = {},
): Promise<RefreshSummary> => {
  const summary: RefreshSummary = { checked: 0, approved: 0, rejected: 0, errors: 0, released: 0 };

  const stuck = await db
    .update(whatsappTemplates)
    .set({ approvalStatus: TemplateApproval.Draft, pendingVariables: null, updatedAt: now })
    .where(
      and(
        eq(whatsappTemplates.approvalStatus, TemplateApproval.Pending),
        isNull(whatsappTemplates.pendingContentSid),
        lte(whatsappTemplates.submittedAt, new Date(now.getTime() - APPROVAL_STUCK_MINUTES * MINUTE_MS)),
      ),
    )
    .returning({ id: whatsappTemplates.id });
  summary.released = stuck.length;

  const pending = await db
    .select({
      id: whatsappTemplates.id,
      pendingContentSid: whatsappTemplates.pendingContentSid,
      pendingVariables: whatsappTemplates.pendingVariables,
    })
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.approvalStatus, TemplateApproval.Pending),
        sql`${whatsappTemplates.pendingContentSid} IS NOT NULL`,
        ids ? inArray(whatsappTemplates.id, ids) : undefined,
      ),
    )
    .orderBy(
      sql`${whatsappTemplates.approvalCheckedAt} ASC NULLS FIRST`,
      asc(whatsappTemplates.submittedAt),
    )
    .limit(limit);

  for (const template of pending) {
    const sid = template.pendingContentSid!;
    const unchanged = and(
      eq(whatsappTemplates.id, template.id),
      eq(whatsappTemplates.approvalStatus, TemplateApproval.Pending),
      eq(whatsappTemplates.pendingContentSid, sid),
    );
    const result = await api.fetchApproval(sid);
    summary.checked++;
    if (!result.ok) {
      summary.errors++;
      await db
        .update(whatsappTemplates)
        .set({ approvalCheckedAt: now })
        .where(unchanged);
      continue;
    }

    const patch = resultPatch(
      {
        pendingContentSid: sid,
        pendingVariables: template.pendingVariables as MessageChip[] | null,
      },
      result,
      now,
    );
    await db
      .update(whatsappTemplates)
      .set({ ...(patch ?? {}), approvalCheckedAt: now, ...(patch ? { updatedAt: now } : {}) })
      .where(unchanged);
    if (patch?.approvalStatus === TemplateApproval.Approved) summary.approved++;
    if (patch?.approvalStatus === TemplateApproval.Rejected) summary.rejected++;
  }
  return summary;
};
