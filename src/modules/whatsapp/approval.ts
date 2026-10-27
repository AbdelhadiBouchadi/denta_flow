import {
  APPROVAL_NAME_SLUG_MAX,
  CONTENT_APPROVAL_STATUS,
} from "./provider-constants";
import { TemplateApproval, type MessageChip, type WhatsappEvent } from "./types";

/**
 * A template's WhatsApp approval lifecycle (prompts/33b, decision 6). Pure:
 * the procedures and the cron's refresh apply these patches, guarded in SQL.
 *
 *   draft ──submit──▶ pending ──approved──▶ approved   (pending promoted to active)
 *     ▲                  │
 *     │                  └──rejected──▶ rejected        (active kept as is)
 *     └────── edit of the text (any state) ──────┘       (active kept as is)
 *
 * `activeContentSid` is the ONLY resource the cron sends with; nothing but an
 * approval replaces it. So editing an approved template never interrupts
 * sending, and a rejection never loses the version already approved.
 */

export interface ApprovalState {
  approvalStatus: TemplateApproval;
  activeContentSid: string | null;
  activeVariables: MessageChip[] | null;
  pendingContentSid: string | null;
  pendingVariables: MessageChip[] | null;
  rejectionReason: string | null;
}

/** Only a draft or a rejected text is sent for approval. */
export const isSubmittable = (status: TemplateApproval) =>
  status === TemplateApproval.Draft || status === TemplateApproval.Rejected;

/**
 * After a save. A new text is a new draft: a review in progress no longer
 * concerns it, a past rejection neither. The approved version stays active.
 */
export const editPatch = (
  bodyChanged: boolean,
): Partial<ApprovalState> =>
  bodyChanged
    ? {
        approvalStatus: TemplateApproval.Draft,
        pendingContentSid: null,
        pendingVariables: null,
        rejectionReason: null,
      }
    : {};

/** The claim before calling the provider — one atomic UPDATE. */
export const claimPatch = (variables: MessageChip[], approvalName: string, now: Date) => ({
  approvalStatus: TemplateApproval.Pending,
  approvalName,
  submittedAt: now,
  approvalCheckedAt: null,
  pendingContentSid: null,
  pendingVariables: variables,
  rejectionReason: null,
});

export type ApprovalOutcome = "approved" | "rejected" | "waiting";

/**
 * Twilio's status → ours. `received`, `pending`, `unsubmitted` (and anything
 * new) are still waiting; `paused` / `disabled` are WhatsApp withdrawing it.
 */
export const approvalOutcome = (status: string): ApprovalOutcome => {
  switch (status.trim().toLowerCase()) {
    case CONTENT_APPROVAL_STATUS.approved:
      return "approved";
    case CONTENT_APPROVAL_STATUS.rejected:
    case CONTENT_APPROVAL_STATUS.paused:
    case CONTENT_APPROVAL_STATUS.disabled:
      return "rejected";
    default:
      return "waiting";
  }
};

/**
 * What a fetched approval status changes, or `null` for nothing. Approval
 * PROMOTES the pending resource; rejection drops it and keeps the active one.
 */
export const resultPatch = (
  state: Pick<ApprovalState, "pendingContentSid" | "pendingVariables">,
  result: { status: string; rejectionReason: string | null },
  now: Date,
): (Partial<ApprovalState> & { approvedAt?: Date }) | null => {
  switch (approvalOutcome(result.status)) {
    case "approved":
      if (!state.pendingContentSid || !state.pendingVariables) return null;
      return {
        approvalStatus: TemplateApproval.Approved,
        activeContentSid: state.pendingContentSid,
        activeVariables: state.pendingVariables,
        pendingContentSid: null,
        pendingVariables: null,
        rejectionReason: null,
        approvedAt: now,
      };
    case "rejected":
      return {
        approvalStatus: TemplateApproval.Rejected,
        pendingContentSid: null,
        pendingVariables: null,
        // `paused` / `disabled` carry no reason: the status is the reason.
        rejectionReason:
          result.rejectionReason?.trim() || result.status.trim().toLowerCase(),
      };
    case "waiting":
      return null;
  }
};

/**
 * May a row of this template be sent now? In the sandbox the text goes as is
 * (no approval exists there); otherwise only an approved resource is sent.
 */
export const isTemplateSendable = (
  template: { activeContentSid: string | null },
  sandbox: boolean,
) => sandbox || template.activeContentSid !== null;

/** «Rappel 24 h» → «rappel_24_h»: ASCII, lowercase, digits, underscores. */
export const slugifyTemplateName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, APPROVAL_NAME_SLUG_MAX)
    .replace(/_+$/, "");

/**
 * The WhatsApp template name of one submission: event + slug + a random
 * suffix — unique per submission, because WhatsApp blocks a deleted or
 * rejected name for 30 days.
 */
export const buildApprovalName = (kind: WhatsappEvent, name: string, suffix: string) =>
  [kind, slugifyTemplateName(name) || "modele", suffix].join("_");
