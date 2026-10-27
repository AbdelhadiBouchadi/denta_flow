import { describe, expect, it } from "vitest";

import { canRetry, mapTwilioStatus, nextStatusFromCallback } from "./status";
import { WhatsappMessageStatus as S } from "./types";

describe("mapTwilioStatus", () => {
  it.each([
    ["queued", null],
    ["accepted", null],
    ["sending", null],
    ["sent", S.Sent],
    ["delivered", S.Delivered],
    ["read", S.Read],
    ["failed", S.Failed],
    ["undelivered", S.Failed],
    ["received", null],
  ])("%s → %s", (twilio, ours) => {
    expect(mapTwilioStatus(twilio)).toBe(ours);
  });
});

describe("nextStatusFromCallback — monotonic", () => {
  it("moves forward sent → delivered → read", () => {
    expect(nextStatusFromCallback(S.Sent, "delivered")).toBe(S.Delivered);
    expect(nextStatusFromCallback(S.Delivered, "read")).toBe(S.Read);
    expect(nextStatusFromCallback(S.Sent, "read")).toBe(S.Read);
  });

  it("never moves backwards on a late older event", () => {
    expect(nextStatusFromCallback(S.Read, "delivered")).toBeNull();
    expect(nextStatusFromCallback(S.Read, "sent")).toBeNull();
    expect(nextStatusFromCallback(S.Delivered, "sent")).toBeNull();
  });

  it("keeps failed final, and never fails a read or delivered message", () => {
    expect(nextStatusFromCallback(S.Sent, "undelivered")).toBe(S.Failed);
    expect(nextStatusFromCallback(S.Failed, "delivered")).toBeNull();
    expect(nextStatusFromCallback(S.Failed, "read")).toBeNull();
    expect(nextStatusFromCallback(S.Read, "failed")).toBeNull();
    expect(nextStatusFromCallback(S.Delivered, "failed")).toBeNull();
  });

  it("is idempotent", () => {
    expect(nextStatusFromCallback(S.Delivered, "delivered")).toBeNull();
  });

  it("never touches a row a human or the cron closed", () => {
    for (const status of [S.Canceled, S.Skipped, S.ManualOpened, S.NeedsAttention]) {
      expect(nextStatusFromCallback(status, "delivered")).toBeNull();
    }
  });
});

describe("canRetry", () => {
  it("allows needs_attention and retryable failures only", () => {
    expect(canRetry(S.NeedsAttention, null)).toBe(true);
    expect(canRetry(S.Failed, "63015")).toBe(true);
    expect(canRetry(S.Failed, "21211")).toBe(false);
    expect(canRetry(S.Failed, null)).toBe(false);
    expect(canRetry(S.Sent, null)).toBe(false);
    expect(canRetry(S.Scheduled, null)).toBe(false);
  });
});
