import { ERROR_MESSAGES } from "@/constants";

/**
 * The fields of a `TRPCClientError` this reads. Structural rather than an
 * `instanceof` check, so the function stays pure and testable without a
 * client, and so it also accepts the error a mutation's `onError` receives.
 */
interface ErrorLike {
  message?: unknown;
  data?: { code?: unknown; zodError?: unknown } | null;
}

const isErrorLike = (value: unknown): value is ErrorLike =>
  typeof value === "object" && value !== null;

/**
 * The French message to toast for a failed tRPC call.
 *
 * - `BAD_REQUEST` carrying `data.zodError` (see the `errorFormatter` in
 *   src/trpc/init.ts) → a French summary. Zod's own `message` is an English
 *   JSON dump of the issues and must never reach a user.
 * - Any other server error → its `message`: every `TRPCError` this app throws
 *   is written in French.
 * - No `data` at all means the request never got a server answer; the
 *   browser's text («Failed to fetch») is English, so ours replaces it.
 */
export function getErrorMessage(error: unknown): string {
  if (!isErrorLike(error) || !error.data) return ERROR_MESSAGES.network;

  if (error.data.code === "BAD_REQUEST" && error.data.zodError) {
    return ERROR_MESSAGES.invalidFields;
  }

  return typeof error.message === "string" && error.message
    ? error.message
    : ERROR_MESSAGES.network;
}
