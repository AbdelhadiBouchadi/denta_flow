import { describe, expect, it } from "vitest";

import {
  generateTemporaryPassword,
  TEMPORARY_PASSWORD_ALPHABET,
  TEMPORARY_PASSWORD_LENGTH,
} from "./temporary-password";

describe("generateTemporaryPassword", () => {
  it("is at least 12 characters, and within Better Auth's 8–128 bounds", () => {
    const password = generateTemporaryPassword();
    expect(TEMPORARY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
    expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    expect(password.length).toBeLessThanOrEqual(128);
  });

  it("draws only from the unambiguous alphabet", () => {
    const allowed = new Set(TEMPORARY_PASSWORD_ALPHABET);
    for (let i = 0; i < 200; i++) {
      for (const char of generateTemporaryPassword()) {
        expect(allowed.has(char)).toBe(true);
      }
    }
  });

  it("never contains a character that reads as another", () => {
    expect(TEMPORARY_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it("does not repeat across many draws", () => {
    const draws = new Set(
      Array.from({ length: 5000 }, () => generateTemporaryPassword()),
    );
    expect(draws.size).toBe(5000);
  });

  it("uses the whole alphabet over enough draws", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateTemporaryPassword()).join(""),
    );
    expect(seen.size).toBe(TEMPORARY_PASSWORD_ALPHABET.length);
  });
});
