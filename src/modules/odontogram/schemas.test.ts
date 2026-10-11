import { describe, expect, it } from "vitest";

import adultRestored from "@/database/fixtures/odontogram-adult-restored.json";
import {
  ODONTOGRAM_LIBRARY_VERSION,
  ODONTOGRAM_MAX_BYTES,
  ODONTOGRAM_VALIDATION_MESSAGES as M,
} from "./constants";
import {
  jsonByteSize,
  jsonDepth,
  odontogramEnvelopeSchema,
  odontogramSaveSchema,
} from "./schemas";

/** The library's own export (src/database/fixtures), wrapped as on save. */
const envelope = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  library: ODONTOGRAM_LIBRARY_VERSION,
  data: adultRestored as Record<string, unknown>,
  ...overrides,
});

const messages = (value: unknown) => {
  const result = odontogramEnvelopeSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("odontogramEnvelopeSchema", () => {
  it("accepts a version 1 envelope around a real library export", () => {
    const parsed = odontogramEnvelopeSchema.parse(envelope());
    // Opaque: handed back untouched, key for key.
    expect(parsed.data).toEqual(adultRestored);
  });

  it("accepts an empty library document — the server never looks inside", () => {
    expect(
      odontogramEnvelopeSchema.safeParse(envelope({ data: {} })).success,
    ).toBe(true);
  });

  it.each(["version", "library", "data"])("rejects a missing %s", (key) => {
    const value: Record<string, unknown> = envelope();
    delete value[key];
    expect(messages(value).length).toBeGreaterThan(0);
  });

  it("rejects another envelope version in French", () => {
    expect(messages(envelope({ version: 2 }))).toEqual([M.envelopeVersion]);
  });

  it("rejects a non-object library document", () => {
    expect(messages(envelope({ data: [1, 2] }))).toEqual([M.envelopeInvalid]);
    expect(messages(envelope({ data: "x" }))).toEqual([M.envelopeInvalid]);
  });

  it("rejects an unknown top-level key", () => {
    expect(messages(envelope({ extra: true }))).toEqual([M.envelopeInvalid]);
  });

  it("rejects more than 512 KB", () => {
    const filler = "x".repeat(ODONTOGRAM_MAX_BYTES);
    const value = envelope({ data: { filler } });
    expect(jsonByteSize(value)).toBeGreaterThan(ODONTOGRAM_MAX_BYTES);
    expect(messages(value)).toEqual([M.tooLarge]);
  });

  it("counts bytes, not characters", () => {
    // «é» is two bytes in UTF-8: half the cap in «é» is over it.
    const filler = "é".repeat(ODONTOGRAM_MAX_BYTES / 2 + 1);
    expect(messages(envelope({ data: { filler } }))).toEqual([M.tooLarge]);
  });

  it("rejects pathological nesting before measuring it", () => {
    let deep: Record<string, unknown> = {};
    const data = deep;
    for (let i = 0; i < 100; i++) {
      deep.child = {};
      deep = deep.child as Record<string, unknown>;
    }
    expect(jsonDepth(envelope({ data }))).toBeGreaterThan(32);
    expect(messages(envelope({ data }))).toEqual([M.tooDeep]);
  });

  it("keeps the real exports far under both limits", () => {
    expect(jsonByteSize(envelope())).toBeLessThan(ODONTOGRAM_MAX_BYTES / 4);
    expect(jsonDepth(envelope())).toBeLessThan(10);
  });
});

describe("odontogramSaveSchema", () => {
  it("takes a null version token for a first save", () => {
    const parsed = odontogramSaveSchema.parse({
      patientId: "p1",
      chart: envelope(),
      expectedUpdatedAt: null,
    });
    expect(parsed.expectedUpdatedAt).toBeNull();
  });

  it("requires the token to be present, even as null", () => {
    expect(
      odontogramSaveSchema.safeParse({ patientId: "p1", chart: envelope() })
        .success,
    ).toBe(false);
  });
});
