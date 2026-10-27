/**
 * The slice's technical values: Twilio endpoints, identifiers, error codes,
 * the env variables automatic mode needs. Never user-facing copy — that is
 * `constants.ts`, which a test keeps free of every term below (prompts/33b,
 * decision 2). Isomorphic: `mode.ts` and `status.ts` read it too.
 */

// ── Messages API ────────────────────────────────────────────────────────────

/** The REST API version every Messages request is pinned to. */
export const TWILIO_API_VERSION = "2010-04-01";
export const TWILIO_API_BASE = `https://api.twilio.com/${TWILIO_API_VERSION}`;

/**
 * Twilio's shared WhatsApp Sandbox sender (twilio.com/docs/whatsapp/sandbox).
 * `TWILIO_WHATSAPP_FROM` equal to this ⇒ sandbox mode.
 */
export const TWILIO_SANDBOX_NUMBER = "+14155238886";

/** `TWILIO_WHATSAPP_FROM` as Twilio expects it: `whatsapp:+<E.164>`. */
export const WHATSAPP_FROM_PATTERN = /^whatsapp:\+[1-9]\d{7,14}$/;

/** Twilio error codes the docs name for WhatsApp (twilio.com/docs/api/errors). */
export const TWILIO_ERROR_CODES = {
  /** The recipient has not joined the sandbox. */
  sandboxNotJoined: "63015",
  /** Free-form message outside the 24-hour customer-service window. */
  outsideWindow: "63016",
  /** Invalid «To» number. */
  invalidTo: "21211",
} as const;

/**
 * `failed` rows whose error is worth a manual «Réessayer»: the recipient may
 * have joined the sandbox since, or Twilio had a passing problem. Everything
 * else (invalid number, unapproved template…) would fail the same way again.
 */
export const RETRYABLE_ERROR_CODES: readonly string[] = [
  TWILIO_ERROR_CODES.sandboxNotJoined,
  "30001", // Queue overflow
  "30008", // Unknown error
  "63018", // Rate limit exceeded for the channel
];

// ── Content API (prompts/33b) ───────────────────────────────────────────────

/**
 * Content API host — NOT api.twilio.com, and JSON bodies, not forms
 * (twilio.com/docs/content/content-api-resources).
 */
export const CONTENT_API_BASE = "https://content.twilio.com/v1";

/** A Content resource SID: «HX» + 32 hex digits. */
export const CONTENT_SID_PATTERN = /^HX[0-9a-fA-F]{32}$/;

/**
 * The approval request's channel segment. The docs' curl example and the
 * resource's `links.approval_create` use the lowercase form.
 */
export const CONTENT_APPROVAL_CHANNEL = "whatsapp";

/** Every template is a transactional appointment message: Utility. */
export const CONTENT_APPROVAL_CATEGORY = "UTILITY";

/** Every template is written in French. */
export const CONTENT_LANGUAGE = "fr";

/**
 * WhatsApp template names: lowercase letters, digits and underscores.
 * Meta caps names at 512 characters; ours stay far shorter.
 */
export const APPROVAL_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
export const APPROVAL_NAME_SLUG_MAX = 32;
export const APPROVAL_NAME_SUFFIX_LENGTH = 6;

/**
 * Twilio's approval statuses (lowercase in the API's JSON). `received` and
 * `pending` (and `unsubmitted`) are still under review; `paused` and
 * `disabled` are WhatsApp withdrawing a template.
 */
export const CONTENT_APPROVAL_STATUS = {
  approved: "approved",
  rejected: "rejected",
  paused: "paused",
  disabled: "disabled",
} as const;

// ── Env ─────────────────────────────────────────────────────────────────────

/** The env variables automatic mode needs — reported as presence only. */
export const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];
