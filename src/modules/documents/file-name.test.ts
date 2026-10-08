import { describe, expect, it } from "vitest";

import { buildDocumentFileName, toFileNamePart } from "./file-name";
import { DocumentType } from "./types";

describe("buildDocumentFileName", () => {
  it("follows Facture_Prenom_NOM_JJ_MM_AAAA_HHmmss.pdf on the clinic clock", () => {
    // 18:00:49 UTC in June is 19:00:49 in Casablanca (UTC+1).
    expect(
      buildDocumentFileName({
        type: DocumentType.Invoice,
        firstName: "Karim",
        lastName: "Benali",
        issuedAt: new Date("2026-06-17T18:00:49Z"),
      }),
    ).toBe("Facture_Karim_BENALI_17_06_2026_190049.pdf");
  });

  it("dates a 00:30 clinic-time document on the clinic's day, not UTC's", () => {
    // 23:30 UTC on 17 June is 00:30 on 18 June in the clinic.
    expect(
      buildDocumentFileName({
        type: DocumentType.Quote,
        firstName: "Salma",
        lastName: "Idrissi",
        issuedAt: new Date("2026-06-17T23:30:00Z"),
      }),
    ).toBe("Devis_Salma_IDRISSI_18_06_2026_003000.pdf");
  });

  it("folds accents and turns spaces and apostrophes into hyphens", () => {
    expect(
      buildDocumentFileName({
        type: DocumentType.Invoice,
        firstName: "Fatima Zahra",
        lastName: "El Aïdi-Ben’Saïd",
        issuedAt: new Date("2026-06-17T08:05:09Z"),
      }),
    ).toBe("Facture_Fatima-Zahra_EL-AIDI-BEN-SAID_17_06_2026_090509.pdf");
  });

  it("is ASCII-only, safe for a Content-Disposition header", () => {
    const name = buildDocumentFileName({
      type: DocumentType.Invoice,
      firstName: "Hélène «Lili»",
      lastName: "Öçal",
      issuedAt: new Date("2026-06-17T08:05:09Z"),
    });
    expect(name).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it("never leaves an empty name part", () => {
    expect(toFileNamePart("  ’ ", "Patient")).toBe("Patient");
  });
});
