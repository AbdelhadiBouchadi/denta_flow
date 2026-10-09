/**
 * How the `/charges` view tells «you may not see this» apart from «it
 * failed». Structural, like `getErrorMessage` (src/lib/errors.ts): it reads
 * the `data.code` a `TRPCClientError` carries, so it stays pure and testable
 * without a client.
 */
const codeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null
    ? (error as { data?: { code?: unknown } | null }).data?.code
    : undefined;

/** The procedure refused the role — the explicit forbidden state, not a retry. */
export const isForbiddenError = (error: unknown) =>
  codeOf(error) === "FORBIDDEN";

/**
 * React Query's `retry` for the admin-only reads: an authorization answer
 * will not change on a second try, so FORBIDDEN and UNAUTHORIZED surface at
 * once instead of after three back-offs; anything else retries as usual.
 */
export const retryUnlessDenied = (failureCount: number, error: unknown) => {
  const code = codeOf(error);
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return false;
  return failureCount < 3;
};
