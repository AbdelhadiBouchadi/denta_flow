import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio's `X-Twilio-Signature` (twilio.com/docs/usage/security): the full
 * URL Twilio called, then every POST parameter sorted by name (case-sensitive,
 * Unix order) with its name and value appended, no delimiters; HMAC-SHA1
 * keyed with the Auth Token; base64.
 *
 * No `server-only` here so Vitest can import it; it holds no secret — the
 * token is passed in by the webhook route.
 */
export const computeTwilioSignature = (
  authToken: string,
  url: string,
  params: Record<string, string>,
) => {
  const payload = Object.keys(params)
    // Code-unit order: the «Unix-style case-sensitive» sort the docs ask for.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
};

/**
 * Constant-time comparison. A missing header, or one of a different length,
 * is refused before `timingSafeEqual` (which throws on unequal lengths).
 */
export const verifyTwilioSignature = ({
  authToken,
  url,
  params,
  signature,
}: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean => {
  if (!signature || !authToken) return false;
  const expected = Buffer.from(computeTwilioSignature(authToken, url, params));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
};

/** `Authorization: Bearer <secret>`, compared in constant time. */
export const verifyBearer = (header: string | null, secret: string | undefined) => {
  if (!header || !secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
};
