import {
  AUTH_ERROR_MESSAGES,
  DEFAULT_AUTH_ERROR_MESSAGE,
  NETWORK_AUTH_ERROR_MESSAGE,
} from "./constants";

/**
 * Better Auth error code -> French copy. The only translation point in the slice.
 *
 * Takes the two primitives off the client's error object rather than the object
 * itself: that keeps this module free of `better-auth/react` (a client bundle)
 * and makes it a pure function the Vitest suite can cover.
 *
 * Never render `error.message` — it is English, and 06-ui.md §6.4 forbids
 * driving behaviour off a message string.
 */
export const getAuthErrorMessage = (
  code?: string | null,
  status?: number | null,
): string => {
  if (code && code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code];
  }

  // No HTTP status at all means the request never reached the server, which is
  // a connectivity problem and not a credentials problem — the clinic's own
  // connection drops often enough that saying so saves a support call.
  if (status === undefined || status === null || status === 0) {
    return NETWORK_AUTH_ERROR_MESSAGE;
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
};
