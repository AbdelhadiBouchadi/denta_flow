import type { SendResult } from "./types";

/**
 * How a Twilio answer becomes a `SendResult`. Pure, so every branch is tested.
 * Twilio's REST errors are JSON: `{ code, message, more_info, status }`.
 */

const readError = (body: unknown) => {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    code:
      record.code === undefined || record.code === null
        ? null
        : String(record.code),
    message: typeof record.message === "string" ? record.message : null,
  };
};

export const classifyTwilioResponse = (
  httpStatus: number,
  body: unknown,
): SendResult => {
  if (httpStatus >= 200 && httpStatus < 300) {
    const sid =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).sid
        : undefined;
    if (typeof sid === "string" && sid.length > 0) {
      return { ok: true, messageId: sid };
    }
    // Accepted without an id we can track: we cannot tell what happened.
    return {
      ok: false,
      kind: "ambiguous",
      code: "missing_sid",
      message: "Twilio accepted the request without a message SID.",
    };
  }

  const error = readError(body);
  const code = error.code ?? `http_${httpStatus}`;
  const message = error.message ?? `HTTP ${httpStatus}`;

  // Rate-limited or a server error: the message was clearly not accepted.
  if (httpStatus === 429 || httpStatus >= 500) {
    return { ok: false, kind: "transient", code, message };
  }
  // Every other 4xx — invalid number, recipient not in the sandbox, template
  // not approved, outside the 24-hour window — fails the same way again.
  return { ok: false, kind: "permanent", code, message };
};

/** Errors raised before the request could reach Twilio. */
const NOT_SENT_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ERR_INVALID_URL",
]);

const errorCode = (error: unknown): string | null => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
};

/**
 * A `fetch` that threw. A timeout (our AbortController) or a reset after the
 * request left is AMBIGUOUS — Twilio may have accepted it, and with no
 * idempotency key a resend could duplicate. A DNS or connection-refused
 * failure never reached Twilio: transient.
 */
export const classifyNetworkError = (error: unknown): SendResult => {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "AbortError" || name === "TimeoutError") {
    return {
      ok: false,
      kind: "ambiguous",
      code: "timeout",
      message: "No answer from Twilio before the timeout.",
    };
  }
  const code = errorCode(error);
  if (code && NOT_SENT_CODES.has(code)) {
    return { ok: false, kind: "transient", code, message: code };
  }
  return {
    ok: false,
    kind: "ambiguous",
    code: code ?? "network_error",
    message: "The connection to Twilio failed after the request was sent.",
  };
};
