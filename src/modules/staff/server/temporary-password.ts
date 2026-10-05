import { randomInt } from "node:crypto";

/**
 * No 0/O, 1/l/I: the password is read off a screen and typed by someone else,
 * often on a phone. Every character is unambiguous in Inter and in mono.
 */
export const TEMPORARY_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * 16 characters over 56 symbols ≈ 93 bits — far past guessing, and within
 * Better Auth's 8–128 length bounds.
 */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * A one-time password for a new or reset account. `randomInt` draws from the
 * OS CSPRNG without modulo bias. The value is returned to the admin once and
 * never logged.
 */
export const generateTemporaryPassword = (
  length = TEMPORARY_PASSWORD_LENGTH,
): string =>
  Array.from(
    { length },
    () =>
      TEMPORARY_PASSWORD_ALPHABET[
        randomInt(TEMPORARY_PASSWORD_ALPHABET.length)
      ],
  ).join("");
