import { describe, expect, it } from "vitest";

import { TWILIO_ERROR_CODES } from "../../constants";
import { SAMPLE_PARAMS } from "../../message";
import { classifyNetworkError, classifyTwilioResponse } from "./classify";
import { buildTwilioForm, createTwilioProvider } from "./twilio";
import type { SendInput } from "./types";

const SID = "HX0123456789abcdef0123456789abcdef";

const input: SendInput = {
  to: "212612345678",
  template: { contentSid: SID, manualText: "Bonjour {prenom}" },
  params: SAMPLE_PARAMS,
  statusCallbackUrl: "https://cabinet.example.ma/api/webhooks/whatsapp",
};

const config = {
  accountSid: "AC" + "0".repeat(32),
  authToken: "token",
  from: "whatsapp:+212600000000",
  sandbox: false,
};

describe("classifyTwilioResponse", () => {
  it("2xx with a SID → accepted", () => {
    expect(classifyTwilioResponse(201, { sid: "SM123" })).toEqual({
      ok: true,
      messageId: "SM123",
    });
  });

  it("2xx without a SID → ambiguous", () => {
    expect(classifyTwilioResponse(201, {})).toMatchObject({
      ok: false,
      kind: "ambiguous",
    });
  });

  it("400 → permanent, with Twilio's code and message", () => {
    expect(
      classifyTwilioResponse(400, {
        code: 21211,
        message: "Invalid 'To' Phone Number",
      }),
    ).toEqual({
      ok: false,
      kind: "permanent",
      code: "21211",
      message: "Invalid 'To' Phone Number",
    });
  });

  it.each([
    TWILIO_ERROR_CODES.sandboxNotJoined,
    TWILIO_ERROR_CODES.outsideWindow,
  ])("the WhatsApp error %s is permanent", (code) => {
    expect(
      classifyTwilioResponse(400, { code: Number(code), message: "x" }),
    ).toMatchObject({ kind: "permanent", code });
  });

  it.each([429, 500, 503])("%s → transient", (status) => {
    expect(classifyTwilioResponse(status, null)).toMatchObject({
      ok: false,
      kind: "transient",
      code: `http_${status}`,
    });
  });
});

describe("classifyNetworkError", () => {
  it("a timeout is ambiguous", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(classifyNetworkError(abort)).toMatchObject({
      kind: "ambiguous",
      code: "timeout",
    });
  });

  it("a refused connection never reached Twilio: transient", () => {
    const refused = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect"), { code: "ECONNREFUSED" }),
    });
    expect(classifyNetworkError(refused)).toMatchObject({ kind: "transient" });
  });

  it("a reset after sending is ambiguous", () => {
    const reset = new TypeError("fetch failed", {
      cause: Object.assign(new Error("socket"), { code: "ECONNRESET" }),
    });
    expect(classifyNetworkError(reset)).toMatchObject({ kind: "ambiguous" });
  });
});

describe("buildTwilioForm", () => {
  it("sends ContentSid and ContentVariables outside the sandbox", () => {
    const form = buildTwilioForm(config, input) as URLSearchParams;
    expect(form.get("From")).toBe("whatsapp:+212600000000");
    expect(form.get("To")).toBe("whatsapp:+212612345678");
    expect(form.get("ContentSid")).toBe(SID);
    expect(JSON.parse(form.get("ContentVariables")!)).toHaveProperty(
      "1",
      "Karim",
    );
    expect(form.get("Body")).toBeNull();
    expect(form.get("StatusCallback")).toBe(input.statusCallbackUrl);
  });

  it("sends the manual text as Body in the sandbox", () => {
    const form = buildTwilioForm(
      { ...config, sandbox: true },
      input,
    ) as URLSearchParams;
    expect(form.get("Body")).toBe("Bonjour Karim");
    expect(form.get("ContentSid")).toBeNull();
  });

  it("refuses a template without SID outside the sandbox", () => {
    const result = buildTwilioForm(config, {
      ...input,
      template: { contentSid: null, manualText: "x" },
    });
    expect(result).toMatchObject({
      error: { kind: "permanent", code: "template_not_configured" },
    });
  });
});

describe("createTwilioProvider", () => {
  it("posts a form with Basic auth to the pinned API version", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const provider = createTwilioProvider(config, (async (
      url: string,
      init: RequestInit,
    ) => {
      seen = { url, init };
      return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 });
    }) as unknown as typeof fetch);

    await expect(provider.send(input)).resolves.toEqual({
      ok: true,
      messageId: "SM1",
    });
    expect(seen!.url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    );
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from(`${config.accountSid}:token`).toString("base64")}`,
    );
  });

  it("turns a thrown timeout into ambiguous", async () => {
    const provider = createTwilioProvider(config, (async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }) as unknown as typeof fetch);
    await expect(provider.send(input)).resolves.toMatchObject({
      kind: "ambiguous",
    });
  });
});
