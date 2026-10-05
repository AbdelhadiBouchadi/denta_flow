import { describe, expect, it } from "vitest";

import { CLINIC_VALIDATION_MESSAGES } from "./constants";
import { clinicSettingsUpdateSchema } from "./schemas";

/** An untouched form, as `toFormValues` builds it for a fresh row. */
const blank = {
  name: "Cabinet Dentaire Dr Amrani",
  address: "",
  city: "",
  phone: "",
  email: "",
  ice: "",
  patente: "",
  fiscalId: "",
  cnssNumber: "",
  inpe: "",
};

const BLOB_URL =
  "https://abc123.public.blob.vercel-storage.com/clinic/logo-x1y2.png";

const firstMessage = (input: unknown) => {
  const result = clinicSettingsUpdateSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("clinicSettingsUpdateSchema", () => {
  it("stores every blank optional field as null, never as an empty string", () => {
    const parsed = clinicSettingsUpdateSchema.parse({
      ...blank,
      address: "   ",
    });
    expect(parsed).toMatchObject({
      address: null,
      city: null,
      phone: null,
      email: null,
      ice: null,
      patente: null,
      fiscalId: null,
      cnssNumber: null,
      inpe: null,
    });
  });

  it("trims every text field", () => {
    const parsed = clinicSettingsUpdateSchema.parse({
      ...blank,
      name: "  Cabinet Atlas  ",
      city: " Agadir ",
      ice: " 002184736000057 ",
    });
    expect(parsed.name).toBe("Cabinet Atlas");
    expect(parsed.city).toBe("Agadir");
    expect(parsed.ice).toBe("002184736000057");
  });

  it("requires a name, and a name of spaces is no name", () => {
    expect(firstMessage({ ...blank, name: "" })).toBe(
      CLINIC_VALIDATION_MESSAGES.nameRequired,
    );
    expect(firstMessage({ ...blank, name: "   " })).toBe(
      CLINIC_VALIDATION_MESSAGES.nameRequired,
    );
  });

  it("accepts identifiers with any content — no length, no format", () => {
    const parsed = clinicSettingsUpdateSchema.parse({
      ...blank,
      ice: "x",
      patente: "Patente n° 48/213-675 (Agadir)",
      fiscalId: "IF".repeat(200),
      cnssNumber: "XR937639",
      inpe: "0",
    });
    expect(parsed.ice).toBe("x");
    expect(parsed.patente).toBe("Patente n° 48/213-675 (Agadir)");
    expect(parsed.fiscalId).toHaveLength(400);
    expect(parsed.cnssNumber).toBe("XR937639");
    expect(parsed.inpe).toBe("0");
  });

  it("rejects a malformed e-mail and accepts a valid one", () => {
    expect(firstMessage({ ...blank, email: "contact@" })).toBe(
      CLINIC_VALIDATION_MESSAGES.invalidEmail,
    );
    expect(
      clinicSettingsUpdateSchema.parse({
        ...blank,
        email: " contact@cabinet.ma ",
      }).email,
    ).toBe("contact@cabinet.ma");
  });

  it("keeps the asset tri-state: url, null to remove, undefined to keep", () => {
    expect(
      clinicSettingsUpdateSchema.parse({ ...blank, logoUrl: BLOB_URL }).logoUrl,
    ).toBe(BLOB_URL);
    expect(
      clinicSettingsUpdateSchema.parse({ ...blank, logoUrl: null }).logoUrl,
    ).toBeNull();
    const untouched = clinicSettingsUpdateSchema.parse(blank);
    expect(untouched.logoUrl).toBeUndefined();
    expect("logoUrl" in untouched).toBe(false);
  });

  it("rejects an asset URL from a foreign host", () => {
    for (const url of [
      "https://evil.example.com/logo.png",
      "https://abc.public.blob.vercel-storage.com.evil.com/logo.png",
      "http://abc123.public.blob.vercel-storage.com/clinic/logo.png",
    ]) {
      expect(firstMessage({ ...blank, logoUrl: url })).toBe(
        CLINIC_VALIDATION_MESSAGES.foreignAsset,
      );
      expect(firstMessage({ ...blank, letterheadUrl: url })).toBe(
        CLINIC_VALIDATION_MESSAGES.foreignAsset,
      );
    }
  });
});
