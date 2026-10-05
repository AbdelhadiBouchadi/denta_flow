import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES } from "@/constants";
import { getErrorMessage } from "./errors";

const ZOD_DUMP = '[{"code":"custom","path":["logoUrl"],"message":"…"}]';

describe("getErrorMessage", () => {
  it("replaces a Zod validation dump with French copy", () => {
    expect(
      getErrorMessage({
        message: ZOD_DUMP,
        data: {
          code: "BAD_REQUEST",
          zodError: { formErrors: [], fieldErrors: { logoUrl: ["…"] } },
        },
      }),
    ).toBe(ERROR_MESSAGES.invalidFields);
  });

  it("keeps the server's message for a BAD_REQUEST that is not a Zod failure", () => {
    expect(
      getErrorMessage({
        message: "Aucune image n’a été reçue.",
        data: { code: "BAD_REQUEST", zodError: null },
      }),
    ).toBe("Aucune image n’a été reçue.");
  });

  it("keeps the server's message for every other code", () => {
    expect(
      getErrorMessage({
        message: "Action réservée à l'administrateur du cabinet.",
        data: { code: "FORBIDDEN", zodError: null },
      }),
    ).toBe("Action réservée à l'administrateur du cabinet.");
  });

  it("never shows the browser's English text when no server answered", () => {
    expect(getErrorMessage({ message: "Failed to fetch" })).toBe(
      ERROR_MESSAGES.network,
    );
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toBe(
      ERROR_MESSAGES.network,
    );
    expect(getErrorMessage(null)).toBe(ERROR_MESSAGES.network);
  });
});
