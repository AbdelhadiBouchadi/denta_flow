import { describe, expect, it, vi } from "vitest";

// The modules under test are server-only; the guard throws outside Next.
vi.mock("server-only", () => ({}));

import { toMedicalDocumentProps } from "./server/render";
import {
  ageOnDay,
  buildCertificateSnapshot,
  buildPrescriptionSnapshot,
  documentSnapshotSchema,
} from "./snapshot";
import { DocumentType } from "./types";

const ISSUED_AT = new Date("2026-10-12T09:30:00Z");

const clinic = {
  name: "Cabinet de test",
  address: "1 rue de l’Exemple",
  city: "Agadir",
  phone: null,
  email: null,
  ice: null,
  patente: null,
  fiscalId: null,
  cnssNumber: null,
  inpe: null,
  logoUrl: null,
};

const base = {
  number: "O-2026",
  issuedAt: ISSUED_AT,
  clinic,
  patient: {
    id: "p1",
    shortCode: "W6U8",
    firstName: "Karim",
    lastName: "Benali",
    cin: "  ",
    birthDate: "1990-10-13",
  },
  practitioner: { name: "Dr Test", title: "Chirurgien-Dentiste", inpe: "" },
  noHeader: false,
};

const prescription = () =>
  buildPrescriptionSnapshot({
    ...base,
    lines: [
      {
        label: "Amoxicilline",
        strength: "1 g",
        posology: "1 comprimé matin et soir",
        duration: "7 jours",
        remark: null,
      },
      { label: "Bain de bouche", strength: "", posology: "3 fois par jour" },
    ],
  });

const certificate = () =>
  buildCertificateSnapshot({
    ...base,
    number: "C-2026",
    templateKey: "repos",
    period: { startDate: "2026-10-12", endDate: "2026-10-14", days: 3 },
    body: "Je soussigné…\nRepos de 3 jours.",
  });

describe("ordonnance snapshot, version 1", () => {
  it("accepts version 1 and round-trips through JSON", () => {
    const stored = JSON.parse(JSON.stringify(prescription()));
    expect(stored.version).toBe(1);
    expect(stored.type).toBe(DocumentType.Prescription);
    expect(documentSnapshotSchema.safeParse(stored).success).toBe(true);
  });

  it("copies each line's text and stores no medication id", () => {
    const snapshot = prescription();
    expect(snapshot.lines[0]).toEqual({
      label: "Amoxicilline",
      strength: "1 g",
      posology: "1 comprimé matin et soir",
      duration: "7 jours",
      remark: null,
    });
    expect(snapshot.lines[1].strength).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain("medicationId");
  });

  it("freezes the age at the issue day and omits an empty CIN and INPE", () => {
    const snapshot = prescription();
    // Born 13 October 1990, issued 12 October 2026: still 35.
    expect(snapshot.patient.age).toBe(35);
    expect(snapshot.patient.cin).toBeNull();
    expect(snapshot.practitioner.inpe).toBeNull();
  });

  it("rejects a snapshot without its practitioner", () => {
    const stored: Record<string, unknown> = { ...prescription() };
    delete stored.practitioner;
    expect(documentSnapshotSchema.safeParse(stored).success).toBe(false);
    expect(
      documentSnapshotSchema.safeParse({ ...prescription(), practitioner: null })
        .success,
    ).toBe(false);
  });

  it("rejects a snapshot without its patient", () => {
    const stored: Record<string, unknown> = { ...prescription() };
    delete stored.patient;
    expect(documentSnapshotSchema.safeParse(stored).success).toBe(false);
  });

  it("rejects zero lines and an unknown version", () => {
    expect(
      documentSnapshotSchema.safeParse({ ...prescription(), lines: [] }).success,
    ).toBe(false);
    expect(
      documentSnapshotSchema.safeParse({ ...prescription(), version: 2 }).success,
    ).toBe(false);
  });
});

describe("certificat snapshot, version 1", () => {
  it("accepts version 1 with its final text and period", () => {
    const stored = JSON.parse(JSON.stringify(certificate()));
    expect(documentSnapshotSchema.safeParse(stored).success).toBe(true);
    expect(stored.body).toBe("Je soussigné…\nRepos de 3 jours.");
    expect(stored.period).toEqual({
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      days: 3,
    });
  });

  it("rejects a snapshot without its practitioner or its patient", () => {
    for (const key of ["practitioner", "patient"]) {
      const stored: Record<string, unknown> = { ...certificate() };
      delete stored[key];
      expect(documentSnapshotSchema.safeParse(stored).success).toBe(false);
    }
  });
});

describe("ageOnDay", () => {
  it("counts whole years on the clinic calendar", () => {
    expect(ageOnDay("1990-10-12", "2026-10-12")).toBe(36);
    expect(ageOnDay("1990-10-13", "2026-10-12")).toBe(35);
    expect(ageOnDay("2000-02-29", "2026-02-28")).toBe(25);
  });

  it("is null when unknown, malformed or in the future", () => {
    expect(ageOnDay(null, "2026-10-12")).toBeNull();
    expect(ageOnDay("1990-13-01", "2026-10-12")).toBeNull();
    expect(ageOnDay("2027-01-01", "2026-10-12")).toBeNull();
  });
});

describe("medical PDF props", () => {
  it("prints the ordonnance title, numbered lines and the place and date", () => {
    const props = toMedicalDocumentProps(
      { ...prescription(), number: "O-2026-0001" },
      null,
    );
    expect(props.title).toBe("ORDONNANCE N° O-2026-0001");
    expect(props.content).toEqual({
      kind: "lines",
      lines: [
        {
          key: "0",
          marker: "1.",
          heading: "Amoxicilline 1 g",
          detail: "1 comprimé matin et soir · Durée : 7 jours",
          remark: null,
        },
        {
          key: "1",
          marker: "2.",
          heading: "Bain de bouche",
          detail: "3 fois par jour",
          remark: null,
        },
      ],
    });
    expect(props.recipient.lines).toEqual(["BENALI Karim", "35 ans"]);
    expect(props.placeAndDate).toBe("Fait à Agadir, le 12/10/2026");
  });

  it("never prints an empty INPE as «—»", () => {
    const props = toMedicalDocumentProps(prescription(), null);
    expect(props.signature.lines).toEqual(["Dr Test", "Chirurgien-Dentiste"]);
    expect(JSON.stringify(props.signature)).not.toContain("—");
  });

  it("«Papier à en-tête» drops the header block", () => {
    expect(toMedicalDocumentProps(prescription(), null).header).not.toBeNull();
    expect(
      toMedicalDocumentProps({ ...prescription(), noHeader: true }, null).header,
    ).toBeNull();
  });

  it("titles a certificat «CERTIFICAT MÉDICAL» and prints its text verbatim", () => {
    const props = toMedicalDocumentProps(
      { ...certificate(), number: "C-2026-0001" },
      null,
    );
    expect(props.title).toBe("CERTIFICAT MÉDICAL N° C-2026-0001");
    expect(props.content).toEqual({
      kind: "text",
      text: "Je soussigné…\nRepos de 3 jours.",
    });
  });
});
