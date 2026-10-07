import { TRPCError } from "@trpc/server";

import { APPOINTMENT_SERVER_ERRORS } from "../constants";

/**
 * Postgres errors an appointment write can raise, mapped to French
 * `TRPCError`s. Free of `db` and `server-only` so the mapping is unit-tested.
 *
 * No `cause` is attached to the TRPCError: a failed query's text carries its
 * parameters, and those include patient ids and notes (08-clinical.md §6).
 */

export const EXCLUSION_VIOLATION = "23P01";
export const FOREIGN_KEY_VIOLATION = "23503";

/** drizzle wraps driver errors in DrizzleQueryError; the code sits on `cause`. */
export const postgresErrorCode = (error: unknown): string | null => {
  let current: unknown = error;

  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const code = (current as Error & { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = current.cause;
  }

  return null;
};

/**
 * The TRPCError a failed appointment write becomes, or `null` when the error
 * is not one this slice knows — the caller rethrows it untouched.
 *
 * `23P01` is the exclusion constraint winning a race the application check
 * could not see: two secretaries saving the same slot at once. It must reach
 * the user as CONFLICT with French copy, never as a 500 (01-database.md §4).
 */
export const toAppointmentWriteError = (error: unknown): TRPCError | null => {
  switch (postgresErrorCode(error)) {
    case EXCLUSION_VIOLATION:
      return new TRPCError({
        code: "CONFLICT",
        message: APPOINTMENT_SERVER_ERRORS.slotJustTaken,
      });
    case FOREIGN_KEY_VIOLATION:
      return new TRPCError({
        code: "BAD_REQUEST",
        message: APPOINTMENT_SERVER_ERRORS.missingReference,
      });
    default:
      return null;
  }
};

export const rethrowAppointmentWriteError = (error: unknown): never => {
  throw toAppointmentWriteError(error) ?? error;
};
