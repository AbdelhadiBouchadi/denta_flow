import { describe, expect, it } from "vitest";

import { DOCUMENT_VALIDATION_MESSAGES as M } from "./constants";
import {
  generateCertificateSchema,
  generatePrescriptionSchema,
} from "./schemas";

const line = { label: "Paracétamol", strength: "1 g", posology: "1 cp × 3/j" };

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("generatePrescription input", () => {
  it("accepts 1 to 20 lines, a free line included", () => {
    const parsed = generatePrescriptionSchema.parse({
      patientId: "p1",
      noHeader: false,
      lines: [line, { label: "Bain de bouche", posology: "3 fois par jour", duration: "" }],
    });
    expect(parsed.lines[1]).toEqual({
      label: "Bain de bouche",
      posology: "3 fois par jour",
      strength: null,
      duration: null,
      remark: null,
    });
  });

  it("refuses zero lines and 21 lines in French", () => {
    expect(
      firstMessage(
        generatePrescriptionSchema.safeParse({ patientId: "p1", noHeader: false, lines: [] }),
      ),
    ).toBe(M.linesEmpty);
    expect(
      firstMessage(
        generatePrescriptionSchema.safeParse({
          patientId: "p1",
          noHeader: false,
          lines: Array(21).fill(line),
        }),
      ),
    ).toBe(M.linesTooMany);
  });

  it("refuses a missing posology and an over-long field in French", () => {
    expect(
      firstMessage(
        generatePrescriptionSchema.safeParse({
          patientId: "p1",
          noHeader: false,
          lines: [{ ...line, posology: "  " }],
        }),
      ),
    ).toBe(M.posologyRequired);
    expect(
      firstMessage(
        generatePrescriptionSchema.safeParse({
          patientId: "p1",
          noHeader: false,
          lines: [{ ...line, remark: "x".repeat(301) }],
        }),
      ),
    ).toBe(M.remarkTooLong);
  });
});

describe("generateCertificate input", () => {
  const valid = { patientId: "p1", body: "{{patient}}", noHeader: false };

  it("accepts a free text with no template and no dates", () => {
    expect(generateCertificateSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses fin < debut, an empty body and an over-long one", () => {
    expect(
      generateCertificateSchema.safeParse({
        ...valid,
        startDate: "2026-10-14",
        endDate: "2026-10-12",
      }).success,
    ).toBe(false);
    expect(firstMessage(generateCertificateSchema.safeParse({ ...valid, body: "  " }))).toBe(
      M.bodyRequired,
    );
    expect(
      firstMessage(generateCertificateSchema.safeParse({ ...valid, body: "x".repeat(4001) })),
    ).toBe(M.bodyTooLong);
  });
});
