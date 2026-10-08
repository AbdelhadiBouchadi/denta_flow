import { toClinicTime, type ClinicDateInput } from "@/lib/time";
import { DOCUMENT_NUMBER_PREFIXES } from "./constants";
import type { GeneratedDocumentType } from "./types";

/**
 * Document numbers: «F-2026-0001», sequential per type and per CLINIC year,
 * no gaps at issue, no duplicates. Deleting a document never renumbers the
 * others — the gap stays visible, as an accountant expects.
 *
 * The authoritative allocation is ONE SQL statement in the procedure (Neon
 * HTTP has no interactive transaction): `INSERT … SELECT MAX(seq) + 1`,
 * guarded by the unique index on `(type, number)`, retried on a unique
 * violation. Everything here is the pure half — the prefix, the format, the
 * JS mirror of that SELECT (used by the seed and the tests) and the retry.
 */

/** At least four digits: «0001» … «9999», then «10000» — never truncated. */
export const SEQUENCE_MIN_DIGITS = 4;

/** «F-2026»: the type's letter and the year on the clinic's wall clock. */
export const documentNumberPrefix = (
  type: GeneratedDocumentType,
  issuedAt: ClinicDateInput,
) => `${DOCUMENT_NUMBER_PREFIXES[type]}-${toClinicTime(issuedAt).getFullYear()}`;

export const formatDocumentNumber = (prefix: string, sequence: number) =>
  `${prefix}-${String(sequence).padStart(SEQUENCE_MIN_DIGITS, "0")}`;

/** The sequence of a number under `prefix`, or null for any other number. */
export const parseDocumentSequence = (prefix: string, number: string) => {
  if (!number.startsWith(`${prefix}-`)) return null;
  const tail = number.slice(prefix.length + 1);
  return /^\d+$/.test(tail) ? Number(tail) : null;
};

/**
 * The next number — the JS mirror of the procedure's SQL: the highest
 * sequence already issued under this type and clinic year, plus one.
 * `existingNumbers` is EVERY row's number, removed documents included: a
 * removed document keeps its row (`deletedAt`), so not even the last number
 * is ever reissued.
 */
export const nextDocumentNumber = (
  type: GeneratedDocumentType,
  issuedAt: ClinicDateInput,
  existingNumbers: readonly (string | null)[],
) => {
  const prefix = documentNumberPrefix(type, issuedAt);
  const highest = existingNumbers.reduce<number>((max, number) => {
    const sequence = number ? parseDocumentSequence(prefix, number) : null;
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);
  return formatDocumentNumber(prefix, highest + 1);
};

// ── Unique-violation retry ──────────────────────────────────────────────────

const UNIQUE_VIOLATION = "23505";

/** drizzle wraps driver errors; the Postgres code sits somewhere on `cause`. */
export const isUniqueViolation = (error: unknown) => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    if ((current as Error & { code?: unknown }).code === UNIQUE_VIOLATION) {
      return true;
    }
    current = current.cause;
  }
  return false;
};

export class NumberUnavailableError extends Error {
  constructor(attempts: number, options?: { cause?: unknown }) {
    super(`No document number after ${attempts} attempts`, options);
    this.name = "NumberUnavailableError";
  }
}

/**
 * Runs `attempt` until it does not lose a race on the unique index. Two
 * concurrent generations read the same MAX and compute the same number; the
 * second insert violates the index, its whole batch rolls back, and it reads
 * the MAX again — now including the winner. Bounded: past `maxAttempts`
 * something else is wrong, and the caller says so in French.
 */
export const withUniqueViolationRetry = async <T>(
  attempt: (attemptNumber: number) => Promise<T>,
  maxAttempts: number,
): Promise<T> => {
  let lastError: unknown;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    try {
      return await attempt(attemptNumber);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }
  throw new NumberUnavailableError(maxAttempts, { cause: lastError });
};
