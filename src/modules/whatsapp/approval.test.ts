import { describe, expect, it } from "vitest";

import {
  approvalOutcome,
  buildApprovalName,
  claimPatch,
  editPatch,
  isSubmittable,
  isTemplateSendable,
  resultPatch,
  slugifyTemplateName,
  type ApprovalState,
} from "./approval";
import { manualSendOffered } from "./manual";
import { APPROVAL_NAME_PATTERN } from "./provider-constants";
import {
  hoursFormSchema,
  hoursToSettings,
  settingsToHours,
} from "./schemas";
import {
  MessageChip as C,
  TemplateApproval as A,
  WhatsappEvent as E,
  WhatsappMessageStatus as S,
  WhatsappMode as M,
  WhatsappSkipReason as R,
} from "./types";

const OLD = "HX" + "1".repeat(32);
const NEW = "HX" + "2".repeat(32);
const now = new Date("2026-10-27T10:00:00Z");

/** Applies patches like the procedures do, to follow a template's life. */
const apply = (state: ApprovalState, ...patches: Partial<ApprovalState>[]) =>
  patches.reduce<ApprovalState>((current, patch) => ({ ...current, ...patch }), state);

const draft: ApprovalState = {
  approvalStatus: A.Draft,
  activeContentSid: null,
  activeVariables: null,
  pendingContentSid: null,
  pendingVariables: null,
  rejectionReason: null,
};

describe("template approval — transitions", () => {
  it("draft → pending → approved promotes the pending resource", () => {
    const pending = apply(draft, claimPatch([C.Date, C.Time], "n", now), {
      pendingContentSid: NEW,
    });
    expect(pending.approvalStatus).toBe(A.Pending);
    expect(pending.activeContentSid).toBeNull();

    const approved = apply(pending, resultPatch(pending, { status: "approved", rejectionReason: null }, now)!);
    expect(approved).toMatchObject({
      approvalStatus: A.Approved,
      activeContentSid: NEW,
      activeVariables: [C.Date, C.Time],
      pendingContentSid: null,
      pendingVariables: null,
    });
  });

  it("draft → pending → rejected keeps the reason and no active resource", () => {
    const pending = apply(draft, claimPatch([C.Date], "n", now), { pendingContentSid: NEW });
    const rejected = apply(
      pending,
      resultPatch(pending, { status: "rejected", rejectionReason: "INVALID_FORMAT" }, now)!,
    );
    expect(rejected).toMatchObject({
      approvalStatus: A.Rejected,
      rejectionReason: "INVALID_FORMAT",
      activeContentSid: null,
      pendingContentSid: null,
    });
    expect(isSubmittable(rejected.approvalStatus)).toBe(true);
  });

  it("a rejection keeps the OLD approved resource", () => {
    const approved: ApprovalState = {
      ...draft,
      approvalStatus: A.Approved,
      activeContentSid: OLD,
      activeVariables: [C.FirstName, C.Date, C.Time],
    };
    const resubmitted = apply(approved, editPatch(true), claimPatch([C.Date, C.Time], "n2", now), {
      pendingContentSid: NEW,
    });
    const rejected = apply(
      resubmitted,
      resultPatch(resubmitted, { status: "rejected", rejectionReason: "SCAM" }, now)!,
    );
    expect(rejected.activeContentSid).toBe(OLD);
    expect(rejected.activeVariables).toEqual([C.FirstName, C.Date, C.Time]);
    expect(rejected.approvalStatus).toBe(A.Rejected);
  });

  it("editing an approved text keeps sending with the approved resource", () => {
    const approved: ApprovalState = {
      ...draft,
      approvalStatus: A.Approved,
      activeContentSid: OLD,
      activeVariables: [C.Date, C.Time],
    };
    const edited = apply(approved, editPatch(true));
    expect(edited.approvalStatus).toBe(A.Draft);
    expect(edited.activeContentSid).toBe(OLD);
    expect(isTemplateSendable(edited, false)).toBe(true);
  });

  it("an edit while pending drops the review, a rename keeps everything", () => {
    const pending = apply(draft, claimPatch([C.Date], "n", now), { pendingContentSid: NEW });
    expect(apply(pending, editPatch(true))).toMatchObject({
      approvalStatus: A.Draft,
      pendingContentSid: null,
    });
    expect(editPatch(false)).toEqual({});
  });

  it("only drafts and refusals are submittable — submitting twice is a no-op", () => {
    expect(isSubmittable(A.Draft)).toBe(true);
    expect(isSubmittable(A.Rejected)).toBe(true);
    expect(isSubmittable(A.Pending)).toBe(false);
    expect(isSubmittable(A.Approved)).toBe(false);
  });

  it.each([
    ["received", "waiting"],
    ["pending", "waiting"],
    ["unsubmitted", "waiting"],
    ["APPROVED", "approved"],
    ["approved", "approved"],
    ["rejected", "rejected"],
    ["paused", "rejected"],
    ["disabled", "rejected"],
  ] as const)("Twilio status %s → %s", (status, outcome) => {
    expect(approvalOutcome(status)).toBe(outcome);
  });

  it("a status still under review changes nothing", () => {
    expect(resultPatch({ pendingContentSid: NEW, pendingVariables: [C.Date] }, { status: "received", rejectionReason: null }, now)).toBeNull();
  });

  it("a paused template carries its status as the reason", () => {
    expect(
      resultPatch({ pendingContentSid: NEW, pendingVariables: [C.Date] }, { status: "paused", rejectionReason: null }, now),
    ).toMatchObject({ approvalStatus: A.Rejected, rejectionReason: "paused" });
  });
});

describe("isTemplateSendable — the cron's unapproved-template skip", () => {
  it("automatic mode needs an approved resource", () => {
    expect(isTemplateSendable({ activeContentSid: null }, false)).toBe(false);
    expect(isTemplateSendable({ activeContentSid: OLD }, false)).toBe(true);
  });

  it("the sandbox sends the text without approval", () => {
    expect(isTemplateSendable({ activeContentSid: null }, true)).toBe(true);
  });
});

describe("buildApprovalName", () => {
  it("is lowercase letters, digits and underscores only", () => {
    expect(buildApprovalName(E.Reminder, "Rappel 24 h — Été !", "ab12cd")).toBe(
      "reminder_rappel_24_h_ete_ab12cd",
    );
    expect(buildApprovalName(E.Cancellation, "€€€", "zz0000")).toBe("cancellation_modele_zz0000");
  });

  it("stays valid and short for any name", () => {
    const names = ["Rappel", "Très long nom ".repeat(20), "  ", "Ça c’est l’été", "123"];
    for (const name of names) {
      const result = buildApprovalName(E.Confirmation, name, "x1y2z3");
      expect(result).toMatch(APPROVAL_NAME_PATTERN);
      expect(result.length).toBeLessThanOrEqual(64);
      expect(result).not.toMatch(/__|^_|_$/);
    }
  });

  it("differs per submission through its suffix", () => {
    const names = new Set(
      Array.from({ length: 50 }, (_, index) =>
        buildApprovalName(E.Reminder, "Rappel", index.toString(36).padStart(6, "0")),
      ),
    );
    expect(names.size).toBe(50);
  });

  it("slugifies accents away", () => {
    expect(slugifyTemplateName("Révision Été")).toBe("revision_ete");
  });
});

describe("manualSendOffered — «Envoyer manuellement» only to rescue", () => {
  it("offers every row in manual mode", () => {
    expect(manualSendOffered({ mode: M.Manual, status: S.Scheduled, skipReason: null })).toBe(true);
  });

  it("offers failed and to-check rows in automatic and test mode", () => {
    for (const mode of [M.Automatic, M.Sandbox]) {
      expect(manualSendOffered({ mode, status: S.Failed, skipReason: null })).toBe(true);
      expect(manualSendOffered({ mode, status: S.NeedsAttention, skipReason: R.TemplateUnapproved })).toBe(true);
      expect(manualSendOffered({ mode, status: S.Scheduled, skipReason: null })).toBe(false);
      expect(manualSendOffered({ mode, status: S.Delivered, skipReason: null })).toBe(false);
    }
  });

  it("offers a skip only when a person can work around it", () => {
    const offered = (skipReason: R) =>
      manualSendOffered({ mode: M.Automatic, status: S.Skipped, skipReason });
    expect(offered(R.NoConsent)).toBe(true);
    expect(offered(R.TooLate)).toBe(true);
    expect(offered(R.ClinicPhoneMissing)).toBe(true);
    expect(offered(R.Landline)).toBe(false);
    expect(offered(R.InvalidPhone)).toBe(false);
  });
});

describe("hoursFormSchema — 24-hour times, the lead in hours", () => {
  const valid = { windowStart: "09:00", windowEnd: "19:00", minLeadHours: 2 };

  it("accepts 24-hour times", () => {
    expect(hoursFormSchema.safeParse(valid).success).toBe(true);
    expect(hoursFormSchema.safeParse({ ...valid, windowEnd: "23:59" }).success).toBe(true);
  });

  it.each(["9:00", "09:00 AM", "9 AM", "24:00", "12:60", "9h"])("refuses «%s»", (time) => {
    expect(hoursFormSchema.safeParse({ ...valid, windowStart: time }).success).toBe(false);
  });

  it("keeps the order and the 0–24 h whole-hour lead", () => {
    expect(hoursFormSchema.safeParse({ ...valid, windowEnd: "08:00" }).success).toBe(false);
    expect(hoursFormSchema.safeParse({ ...valid, minLeadHours: 25 }).success).toBe(false);
    expect(hoursFormSchema.safeParse({ ...valid, minLeadHours: 1.5 }).success).toBe(false);
    expect(hoursFormSchema.safeParse({ ...valid, minLeadHours: 0 }).success).toBe(true);
  });

  it("stores minutes, shows hours", () => {
    expect(hoursToSettings(valid, true)).toEqual({
      enabled: true,
      windowStart: "09:00",
      windowEnd: "19:00",
      minLeadMinutes: 120,
    });
    expect(
      settingsToHours({ enabled: false, windowStart: "09:00", windowEnd: "19:00", minLeadMinutes: 90 }),
    ).toMatchObject({ minLeadHours: 2 });
  });
});
