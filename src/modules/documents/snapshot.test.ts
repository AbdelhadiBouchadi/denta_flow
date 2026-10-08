import { describe, expect, it, vi } from "vitest";

// The modules under test are server-only; the guard throws outside Next.
vi.mock("server-only", () => ({}));

import { BALANCE_LABELS } from "@/lib/format";
import { DOCUMENT_PDF_COPY as P } from "./constants";
import { toBillingDocumentProps } from "./server/render";
import {
  buildDocumentSnapshot,
  documentSnapshotSchema,
  pickPractitionerId,
  type BuildSnapshotInput,
} from "./snapshot";
import { DocumentType } from "./types";

const ISSUED_AT = new Date("2026-06-17T18:00:49Z");

const clinic = {
  name: "Cabinet de test",
  address: "1 rue de l’Exemple",
  city: "Agadir",
  phone: "+212528000000",
  email: null,
  ice: "000000000000001",
  patente: "",
  fiscalId: "   ",
  cnssNumber: null,
  inpe: null,
  logoUrl: null,
};

const lines = [
  {
    id: "t1",
    performedAt: new Date("2026-06-10T09:00:00Z"),
    createdAt: new Date("2026-06-10T09:00:00Z"),
    label: "Composite deux faces",
    nomenclatureCode: "D 30",
    teeth: ["26", "27"],
    totalAmountCents: 250000,
  },
  {
    id: "t2",
    performedAt: null,
    createdAt: new Date("2026-06-12T09:00:00Z"),
    label: "Détartrage",
    nomenclatureCode: null,
    teeth: [],
    totalAmountCents: 150000,
  },
];

const base = {
  number: "F-2026",
  issuedAt: ISSUED_AT,
  clinic,
  patient: {
    id: "p1",
    shortCode: "W6U8",
    firstName: "Karim",
    lastName: "Benali",
    cin: null,
    phone: "+212661234567",
  },
  practitioner: { name: "Dr Test", title: "Chirurgien-Dentiste", inpe: null },
  lines,
};

const invoice = (remainingCents: number): BuildSnapshotInput => ({
  ...base,
  type: DocumentType.Invoice,
  account: {
    totalAmountCents: 400000,
    amountPaidCents: 400000 - remainingCents,
    remainingCents,
  },
});

describe("document snapshot", () => {
  it("builds a version 1 snapshot whose total is the sum of its lines", () => {
    const snapshot = buildDocumentSnapshot(invoice(100000));
    expect(snapshot.version).toBe(1);
    expect(snapshot.totalCents).toBe(400000);
    expect(snapshot.lines[1].date).toBe("2026-06-12T09:00:00.000Z");
    expect(documentSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("omits an empty identifier rather than storing it", () => {
    const snapshot = buildDocumentSnapshot(invoice(0));
    expect(snapshot.clinic.ice).toBe("000000000000001");
    expect(snapshot.clinic.patente).toBeNull();
    expect(snapshot.clinic.fiscalId).toBeNull();
  });

  it("accepts a stored version 1 snapshot round-tripped through JSON", () => {
    const stored = JSON.parse(JSON.stringify(buildDocumentSnapshot(invoice(0))));
    expect(documentSnapshotSchema.safeParse(stored).success).toBe(true);
  });

  it("rejects a snapshot missing its identity block", () => {
    const withoutClinic: Record<string, unknown> = {
      ...buildDocumentSnapshot(invoice(0)),
    };
    delete withoutClinic.clinic;
    expect(documentSnapshotSchema.safeParse(withoutClinic).success).toBe(false);
  });

  it("rejects an unknown version", () => {
    const snapshot = { ...buildDocumentSnapshot(invoice(0)), version: 2 };
    expect(documentSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });

  it("keeps payments off a devis", () => {
    const quote = buildDocumentSnapshot({
      ...base,
      type: DocumentType.Quote,
      validUntil: "2026-07-17",
    });
    expect(quote).not.toHaveProperty("account");
    expect(quote.type === DocumentType.Quote && quote.validUntil).toBe(
      "2026-07-17",
    );
  });

  it("prints the acte's practitioner only when every line shares one", () => {
    expect(pickPractitionerId([{ practitionerId: "d1" }, { practitionerId: "d1" }], "me")).toBe("d1");
    expect(pickPractitionerId([{ practitionerId: "d1" }, { practitionerId: "d2" }], "me")).toBe("me");
    expect(pickPractitionerId([{ practitionerId: null }], "me")).toBe("me");
  });
});

describe("facture totals through describeBalance", () => {
  const situation = (remainingCents: number) =>
    toBillingDocumentProps(buildDocumentSnapshot(invoice(remainingCents)), null)
      .situation!;

  it("reads «Reste à payer» while something is owed", () => {
    const rows = situation(100000).rows;
    expect(rows.at(-1)).toEqual({
      label: BALANCE_LABELS.due,
      value: "1 000,00 DH",
      emphasis: true,
    });
    expect(rows).toContainEqual({ label: P.paidToDate, value: "3 000,00 DH" });
  });

  it("reads «Avance», never a minus sign, after an overpayment", () => {
    const rows = situation(-25000).rows;
    expect(rows.at(-1)).toEqual({
      label: BALANCE_LABELS.credit,
      value: "250,00 DH",
      emphasis: true,
    });
    expect(JSON.stringify(rows)).not.toContain("-");
  });

  it("labels the account situation with the generation date", () => {
    expect(situation(0).caption).toBe("Situation du compte au 17/06/2026");
  });

  it("prints «4 000,00 DH» as the total and omits empty identifiers", () => {
    const props = toBillingDocumentProps(buildDocumentSnapshot(invoice(0)), null);
    expect(props.totals[0]).toMatchObject({ value: "4 000,00 DH" });
    expect(props.header.identifiers).toBe("ICE 000000000000001");
    expect(props.title).toBe("FACTURE N° F-2026");
  });
});
