import { describe, expect, it } from "vitest";

import { createTwilioContentApi, readApproval } from "./twilio-content";

const config = { accountSid: "AC" + "0".repeat(32), authToken: "token" };
const SID = "HX" + "a".repeat(32);

/** A fetch that records each call and answers from a queue. */
const recorder = (...answers: { status: number; body: unknown }[]) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const answer = answers.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as unknown as typeof fetch;
  return { calls, impl };
};

describe("Content API client (twilio.com/docs/content)", () => {
  it("creates a twilio/text resource with JSON on content.twilio.com", async () => {
    const { calls, impl } = recorder({ status: 201, body: { sid: SID } });
    const api = createTwilioContentApi(config, impl);
    await expect(
      api.create({
        friendlyName: "reminder_rappel_ab12cd",
        language: "fr",
        body: "Bonjour {{1}}, le {{2}}.",
        variables: { "1": "Karim", "2": "mercredi 15 octobre" },
      }),
    ).resolves.toEqual({ ok: true, sid: SID });

    expect(calls[0].url).toBe("https://content.twilio.com/v1/Content");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from(`${config.accountSid}:token`).toString("base64")}`,
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      friendly_name: "reminder_rappel_ab12cd",
      language: "fr",
      variables: { "1": "Karim", "2": "mercredi 15 octobre" },
      types: { "twilio/text": { body: "Bonjour {{1}}, le {{2}}." } },
    });
  });

  it("asks WhatsApp for approval: name + UTILITY on …/ApprovalRequests/whatsapp", async () => {
    const { calls, impl } = recorder({ status: 201, body: { status: "received" } });
    const api = createTwilioContentApi(config, impl);
    await expect(
      api.submitForWhatsapp(SID, { name: "reminder_rappel_ab12cd", category: "UTILITY" }),
    ).resolves.toEqual({ ok: true, status: "received" });
    expect(calls[0].url).toBe(`https://content.twilio.com/v1/Content/${SID}/ApprovalRequests/whatsapp`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      name: "reminder_rappel_ab12cd",
      category: "UTILITY",
    });
  });

  it("reads the approval status and the rejection reason", async () => {
    const { calls, impl } = recorder({
      status: 200,
      body: {
        sid: SID,
        whatsapp: { status: "rejected", rejection_reason: "INVALID_FORMAT", name: "x" },
      },
    });
    const api = createTwilioContentApi(config, impl);
    await expect(api.fetchApproval(SID)).resolves.toEqual({
      ok: true,
      status: "rejected",
      rejectionReason: "INVALID_FORMAT",
    });
    expect(calls[0].url).toBe(`https://content.twilio.com/v1/Content/${SID}/ApprovalRequests`);
    expect(calls[0].init.method).toBe("GET");
  });

  it("treats an empty reason as none and a missing WhatsApp part as received", async () => {
    expect(readApproval({ whatsapp: { status: "pending", rejection_reason: "" } })).toEqual({
      status: "pending",
      rejectionReason: null,
    });
    const { impl } = recorder({ status: 200, body: { sid: SID } });
    await expect(createTwilioContentApi(config, impl).fetchApproval(SID)).resolves.toMatchObject({
      status: "received",
    });
  });

  it("returns the provider's code on a refusal, and a missing SID as a failure", async () => {
    const { impl } = recorder(
      { status: 400, body: { code: 20001, message: "Invalid body" } },
      { status: 201, body: {} },
    );
    const api = createTwilioContentApi(config, impl);
    const input = { friendlyName: "n", language: "fr", body: "b", variables: {} };
    await expect(api.create(input)).resolves.toEqual({
      ok: false,
      code: "20001",
      message: "Invalid body",
    });
    await expect(api.create(input)).resolves.toMatchObject({ ok: false, code: "missing_sid" });
  });

  it("turns a timeout into a failure, never a throw", async () => {
    const impl = (async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }) as unknown as typeof fetch;
    await expect(createTwilioContentApi(config, impl).fetchApproval(SID)).resolves.toMatchObject({
      ok: false,
      code: "timeout",
    });
  });
});
