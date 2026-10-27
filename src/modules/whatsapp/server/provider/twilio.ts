import { SEND_TIMEOUT_MS, TWILIO_API_BASE } from "../../constants";
import { renderManualText, toContentVariables } from "../../message";
import { classifyNetworkError, classifyTwilioResponse } from "./classify";
import type { MessagingProvider, SendInput, SendResult } from "./types";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** `whatsapp:+…`, as `TWILIO_WHATSAPP_FROM` holds it. */
  from: string;
  sandbox: boolean;
}

/**
 * The form body of one `POST …/Messages.json`. In the sandbox, custom
 * templates are not available: the manual text goes as `Body` (accepted only
 * inside the 24-hour window the recipient's «join» opened).
 */
export const buildTwilioForm = (
  config: Pick<TwilioConfig, "from" | "sandbox">,
  input: SendInput,
): URLSearchParams | { error: SendResult } => {
  const form = new URLSearchParams({
    From: config.from,
    To: `whatsapp:+${input.to}`,
  });

  if (config.sandbox) {
    form.set("Body", renderManualText(input.template.manualText, input.params));
  } else if (input.template.contentSid) {
    // `ContentSid` replaces `Body` (Content API docs).
    form.set("ContentSid", input.template.contentSid);
    form.set("ContentVariables", toContentVariables(input.params));
  } else {
    return {
      error: {
        ok: false,
        kind: "permanent",
        code: "template_not_configured",
        message: "The template has no Twilio Content SID.",
      },
    };
  }

  if (input.statusCallbackUrl) {
    form.set("StatusCallback", input.statusCallbackUrl);
  }
  return form;
};

/**
 * Twilio's REST API through `fetch` — Basic auth with the Account SID and
 * Auth Token, `application/x-www-form-urlencoded`. No `twilio` package.
 * Logs nothing: the caller logs message ids only.
 */
export const createTwilioProvider = (
  config: TwilioConfig,
  fetchImpl: typeof fetch = fetch,
): MessagingProvider => ({
  channel: "whatsapp_twilio",
  sandbox: config.sandbox,
  async send(input) {
    const form = buildTwilioForm(config, input);
    if ("error" in form) return form.error;

    const credentials = Buffer.from(
      `${config.accountSid}:${config.authToken}`,
    ).toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetchImpl(
        `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
          signal: controller.signal,
          cache: "no-store",
        },
      );
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return classifyTwilioResponse(response.status, body);
    } catch (error) {
      return classifyNetworkError(error);
    } finally {
      clearTimeout(timer);
    }
  },
});
