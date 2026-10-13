import { describe, expect, it } from "vitest";

import {
  formatMedicationLabel,
  medicationNameKey,
  normalizeMedicationText,
} from "./normalize";
import { medicationFormSchema, packFormSchema } from "./schemas";

describe("normalizeMedicationText", () => {
  it("trims and collapses inner whitespace, keeping case and accents", () => {
    expect(normalizeMedicationText("  Paracétamol \t  codéiné ")).toBe(
      "Paracétamol codéiné",
    );
  });
});

describe("medicationNameKey", () => {
  it("folds case, accents and spaces: one medication", () => {
    expect(medicationNameKey("Paracétamol", "1 g")).toBe(
      medicationNameKey("  paracetamol ", "1  G"),
    );
  });

  it("keeps two strengths of one molecule apart", () => {
    expect(medicationNameKey("Amoxicilline", "1 g")).not.toBe(
      medicationNameKey("Amoxicilline", "500 mg"),
    );
  });

  it("tells «no strength» apart from any strength", () => {
    expect(medicationNameKey("Bain de bouche au bicarbonate", null)).toBe(
      "bain de bouche au bicarbonate|",
    );
  });
});

describe("the medication form schema", () => {
  it("stores the normalised text and turns blanks into null", () => {
    const parsed = medicationFormSchema.parse({
      name: "  Ibuprofène ",
      form: "comprimé",
      strength: "  400  mg ",
      defaultPosology: "   ",
      defaultDuration: null,
    });
    expect(parsed).toEqual({
      name: "Ibuprofène",
      form: "comprimé",
      strength: "400 mg",
      defaultPosology: null,
      defaultDuration: null,
    });
    expect(formatMedicationLabel(parsed)).toBe("Ibuprofène 400 mg");
  });

  it("refuses a blank name in French", () => {
    const result = medicationFormSchema.safeParse({ name: "   ", form: "gel" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Indiquez le nom du médicament.",
    );
  });

  it("a pack holds 1 to 20 items, each with a posology", () => {
    const item = { medicationId: "m1", posology: "1 cp" };
    expect(packFormSchema.safeParse({ name: "P", items: [] }).success).toBe(false);
    expect(
      packFormSchema.safeParse({ name: "P", items: Array(21).fill(item) }).success,
    ).toBe(false);
    expect(
      packFormSchema.safeParse({
        name: "P",
        items: [{ medicationId: "m1", posology: " " }],
      }).success,
    ).toBe(false);
    expect(packFormSchema.safeParse({ name: "P", items: [item] }).success).toBe(
      true,
    );
  });
});
