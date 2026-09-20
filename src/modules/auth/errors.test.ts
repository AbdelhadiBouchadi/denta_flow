import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_MESSAGES,
  DEFAULT_AUTH_ERROR_MESSAGE,
  NETWORK_AUTH_ERROR_MESSAGE,
} from "@/modules/auth/constants";
import { getAuthErrorMessage } from "@/modules/auth/errors";

describe("getAuthErrorMessage", () => {
  it("maps a known Better Auth code to its French copy", () => {
    expect(getAuthErrorMessage("INVALID_EMAIL_OR_PASSWORD", 401)).toBe(
      "Adresse e-mail ou mot de passe incorrect.",
    );
    expect(getAuthErrorMessage("EMAIL_PASSWORD_SIGN_UP_DISABLED", 400)).toBe(
      AUTH_ERROR_MESSAGES.EMAIL_PASSWORD_SIGN_UP_DISABLED,
    );
  });

  it("reports a deactivated account rather than a generic failure", () => {
    expect(getAuthErrorMessage("FAILED_TO_CREATE_SESSION", 401)).toBe(
      "Ce compte a été désactivé. Contactez l’administrateur du cabinet.",
    );
  });

  it("falls back to the generic message for an unmapped code", () => {
    expect(getAuthErrorMessage("SOME_PLUGIN_CODE", 500)).toBe(
      DEFAULT_AUTH_ERROR_MESSAGE,
    );
  });

  it("reports a connectivity failure when no status came back", () => {
    expect(getAuthErrorMessage(undefined, undefined)).toBe(
      NETWORK_AUTH_ERROR_MESSAGE,
    );
    expect(getAuthErrorMessage(null, 0)).toBe(NETWORK_AUTH_ERROR_MESSAGE);
  });

  it("prefers the code over the status when both are present", () => {
    expect(getAuthErrorMessage("USER_ALREADY_EXISTS", 0)).toBe(
      "Un compte existe déjà pour cette adresse e-mail.",
    );
  });

  it("never leaks an English message: every mapped value is French copy", () => {
    for (const message of Object.values(AUTH_ERROR_MESSAGES)) {
      expect(message).not.toMatch(
        /\b(password|invalid|failed|not found|already exists|too short|please|try again)\b/i,
      );
      expect(message.trim()).not.toBe("");
    }
  });
});
