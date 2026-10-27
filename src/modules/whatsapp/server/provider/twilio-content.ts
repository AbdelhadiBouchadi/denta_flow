import { SEND_TIMEOUT_MS } from "../../constants";
import {
  CONTENT_API_BASE,
  CONTENT_APPROVAL_CHANNEL,
  CONTENT_SID_PATTERN,
} from "../../provider-constants";
import type { TwilioConfig } from "./twilio";

/**
 * Twilio's Content API through `fetch` (prompts/33b) — creating a template,
 * asking WhatsApp to approve it, reading the verdict. Confirmed against
 * twilio.com/docs/content/content-api-resources and «create and send your
 * first Content API template»:
 *
 * - host `content.twilio.com/v1`, **JSON** bodies (the Messages API takes
 *   forms), Basic auth — Account SID + Auth Token, as the docs allow;
 * - `POST /Content` `{ friendly_name, language, variables, types:
 *   { "twilio/text": { body } } }` → `{ sid: "HX…" }`;
 * - `POST /Content/{sid}/ApprovalRequests/whatsapp` `{ name, category }`;
 * - `GET /Content/{sid}/ApprovalRequests` → `{ whatsapp: { status,
 *   rejection_reason, … } }`, statuses in lowercase;
 * - `DELETE /Content/{sid}` removes the resource from Twilio only.
 *
 * Logs nothing. Returns the provider's code and message on failure — they
 * reach the activity log and «Diagnostic technique», never a clinic screen.
 */

export type ContentFailure = { ok: false; code: string; message: string };
export type ContentResult<T> = ({ ok: true } & T) | ContentFailure;

export interface CreateContentInput {
  friendlyName: string;
  language: string;
  body: string;
  /** Example values — WhatsApp's reviewers read them. */
  variables: Record<string, string>;
}

export interface ContentApi {
  create(input: CreateContentInput): Promise<ContentResult<{ sid: string }>>;
  submitForWhatsapp(
    sid: string,
    request: { name: string; category: string },
  ): Promise<ContentResult<{ status: string }>>;
  fetchApproval(
    sid: string,
  ): Promise<ContentResult<{ status: string; rejectionReason: string | null }>>;
  /** Best effort: an orphan resource costs nothing and is never sent. */
  remove(sid: string): Promise<void>;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const failure = (httpStatus: number, body: unknown): ContentFailure => {
  const error = record(body);
  return {
    ok: false,
    code: error.code != null ? String(error.code) : `http_${httpStatus}`,
    message: typeof error.message === "string" ? error.message : `HTTP ${httpStatus}`,
  };
};

const networkFailure = (error: unknown): ContentFailure => ({
  ok: false,
  code:
    (error as { name?: unknown } | null)?.name === "AbortError"
      ? "timeout"
      : "network_error",
  message: error instanceof Error ? error.message : "network error",
});

/** `GET …/ApprovalRequests` → the WhatsApp part, or `null` if absent. */
export const readApproval = (body: unknown) => {
  const whatsapp = record(record(body).whatsapp);
  const status = typeof whatsapp.status === "string" ? whatsapp.status : null;
  if (!status) return null;
  const reason = whatsapp.rejection_reason;
  return {
    status,
    rejectionReason: typeof reason === "string" && reason.trim() !== "" ? reason : null,
  };
};

export const createTwilioContentApi = (
  config: Pick<TwilioConfig, "accountSid" | "authToken">,
  fetchImpl: typeof fetch = fetch,
): ContentApi => {
  const authorization = `Basic ${Buffer.from(
    `${config.accountSid}:${config.authToken}`,
  ).toString("base64")}`;

  const call = async (
    method: "GET" | "POST" | "DELETE",
    path: string,
    json?: unknown,
  ): Promise<{ status: number; body: unknown }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${CONTENT_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: controller.signal,
        cache: "no-store",
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    } finally {
      clearTimeout(timer);
    }
  };

  const ok = (status: number) => status >= 200 && status < 300;
  const sidPath = (sid: string) => `/Content/${encodeURIComponent(sid)}`;

  return {
    async create(input) {
      try {
        const { status, body } = await call("POST", "/Content", {
          friendly_name: input.friendlyName,
          language: input.language,
          variables: input.variables,
          types: { "twilio/text": { body: input.body } },
        });
        if (!ok(status)) return failure(status, body);
        const sid = record(body).sid;
        if (typeof sid !== "string" || !CONTENT_SID_PATTERN.test(sid)) {
          return { ok: false, code: "missing_sid", message: "No Content SID in the answer." };
        }
        return { ok: true, sid };
      } catch (error) {
        return networkFailure(error);
      }
    },

    async submitForWhatsapp(sid, request) {
      try {
        const { status, body } = await call(
          "POST",
          `${sidPath(sid)}/ApprovalRequests/${CONTENT_APPROVAL_CHANNEL}`,
          request,
        );
        if (!ok(status)) return failure(status, body);
        const answer = record(body).status;
        return { ok: true, status: typeof answer === "string" ? answer : "received" };
      } catch (error) {
        return networkFailure(error);
      }
    },

    async fetchApproval(sid) {
      try {
        const { status, body } = await call("GET", `${sidPath(sid)}/ApprovalRequests`);
        if (!ok(status)) return failure(status, body);
        const approval = readApproval(body);
        // No WhatsApp part yet: the request is still being registered.
        return { ok: true, ...(approval ?? { status: "received", rejectionReason: null }) };
      } catch (error) {
        return networkFailure(error);
      }
    },

    async remove(sid) {
      try {
        await call("DELETE", sidPath(sid));
      } catch {
        // Best effort.
      }
    },
  };
};

// ── Fake, for tests and fixture runs ────────────────────────────────────────

export interface FakeContentApi extends ContentApi {
  calls: { method: keyof ContentApi; sid?: string; input?: unknown }[];
  /** The status `fetchApproval` answers for a SID; default `pending`. */
  verdicts: Map<string, { status: string; rejectionReason: string | null }>;
  /** Make the next create / approval request fail. */
  failNext: Partial<Record<"create" | "submitForWhatsapp", ContentFailure>>;
}

export const createFakeContentApi = (): FakeContentApi => {
  let counter = 0;
  const api: FakeContentApi = {
    calls: [],
    verdicts: new Map(),
    failNext: {},
    async create(input) {
      api.calls.push({ method: "create", input });
      const failed = api.failNext.create;
      if (failed) {
        delete api.failNext.create;
        return failed;
      }
      counter += 1;
      return { ok: true, sid: `HX${String(counter).padStart(32, "0")}` };
    },
    async submitForWhatsapp(sid, request) {
      api.calls.push({ method: "submitForWhatsapp", sid, input: request });
      const failed = api.failNext.submitForWhatsapp;
      if (failed) {
        delete api.failNext.submitForWhatsapp;
        return failed;
      }
      return { ok: true, status: "received" };
    },
    async fetchApproval(sid) {
      api.calls.push({ method: "fetchApproval", sid });
      return { ok: true, ...(api.verdicts.get(sid) ?? { status: "pending", rejectionReason: null }) };
    },
    async remove(sid) {
      api.calls.push({ method: "remove", sid });
    },
  };
  return api;
};
