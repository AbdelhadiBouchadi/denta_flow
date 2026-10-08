import { describe, expect, it } from "vitest";

import { documentType } from "@/database/schema";
import { BILLABLE_TREATMENT_STATUSES } from "@/database/sql/billable";
import { DOCUMENT_TYPE_LABELS, GENERATED_DOCUMENT_TYPE_VALUES } from "./constants";
import {
  DOCUMENT_ELIGIBLE_STATUSES,
  selectDocumentLines,
  sumSelectedCents,
} from "./rules";
import { DocumentType } from "./types";

const acte = (id: string, status: string, patientId = "p1") => ({
  id,
  patientId,
  status,
});

const rows = [
  acte("done", "completed"),
  acte("ongoing", "in_progress"),
  acte("plan", "planned"),
  acte("void", "canceled"),
  acte("foreign", "completed", "p2"),
];

const select = (type: DocumentType.Invoice | DocumentType.Quote, ids: string[]) =>
  selectDocumentLines({ type, patientId: "p1", requestedIds: ids, rows });

describe("document type enum", () => {
  it("mirrors the document_type pgEnum, with a label per value", () => {
    expect(Object.values(DocumentType).sort()).toEqual(
      [...documentType.enumValues].sort(),
    );
    for (const type of documentType.enumValues) {
      expect(DOCUMENT_TYPE_LABELS[type as DocumentType]).toBeTruthy();
    }
  });

  it("offers only the types generated today", () => {
    expect([...GENERATED_DOCUMENT_TYPE_VALUES]).toEqual([
      DocumentType.Invoice,
      DocumentType.Quote,
    ]);
  });
});

describe("line selection", () => {
  it("bills exactly the shared billable statuses (src/database/sql/billable.ts)", () => {
    expect([...DOCUMENT_ELIGIBLE_STATUSES[DocumentType.Invoice]].sort()).toEqual(
      [...BILLABLE_TREATMENT_STATUSES].sort(),
    );
  });

  it("accepts in-progress and completed actes on a facture, in the requested order", () => {
    const result = select(DocumentType.Invoice, ["ongoing", "done"]);
    expect(result).toEqual({
      ok: true,
      lines: [rows[1], rows[0]],
    });
  });

  it("never puts a canceled or a planned acte on a facture", () => {
    expect(select(DocumentType.Invoice, ["done", "void"])).toEqual({
      ok: false,
      error: "notBillable",
    });
    expect(select(DocumentType.Invoice, ["plan"])).toEqual({
      ok: false,
      error: "notBillable",
    });
  });

  it("puts only planned actes on a devis", () => {
    expect(select(DocumentType.Quote, ["plan"])).toMatchObject({ ok: true });
    expect(select(DocumentType.Quote, ["plan", "done"])).toEqual({
      ok: false,
      error: "notPlanned",
    });
    expect(select(DocumentType.Quote, ["void"])).toEqual({
      ok: false,
      error: "notPlanned",
    });
  });

  it("rejects another patient's acte and an unknown id", () => {
    expect(select(DocumentType.Invoice, ["foreign"])).toEqual({
      ok: false,
      error: "notOwned",
    });
    expect(select(DocumentType.Invoice, ["ghost"])).toEqual({
      ok: false,
      error: "notOwned",
    });
  });

  it("rejects an empty selection and collapses duplicates", () => {
    expect(select(DocumentType.Invoice, [])).toEqual({
      ok: false,
      error: "emptySelection",
    });
    const result = select(DocumentType.Invoice, ["done", "done"]);
    expect(result.ok && result.lines).toHaveLength(1);
  });

  it("sums only the selected actes for the preview", () => {
    const items = [
      { id: "a", totalAmountCents: 250000 },
      { id: "b", totalAmountCents: 150000 },
    ];
    expect(sumSelectedCents(items, ["a", "b"])).toBe(400000);
    expect(sumSelectedCents(items, ["b"])).toBe(150000);
    expect(sumSelectedCents(items, [])).toBe(0);
  });
});
