import { describe, expect, it } from "vitest";

import { INSURER_VALIDATION_MESSAGES } from "./constants";
import { insurerOptionLabel, selectableInsurers } from "./options";
import { insurerFormSchema, insurerUpdateSchema } from "./schemas";

describe("insurerFormSchema", () => {
  it("trims the name", () => {
    expect(insurerFormSchema.parse({ name: "  CNOPS " }).name).toBe("CNOPS");
  });

  it("requires a name, whitespace included", () => {
    for (const name of ["", "   "]) {
      const result = insurerFormSchema.safeParse({ name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        INSURER_VALIDATION_MESSAGES.nameRequired,
      );
    }
  });

  it("requires an id on update", () => {
    expect(insurerUpdateSchema.safeParse({ name: "AXA" }).success).toBe(false);
    expect(
      insurerUpdateSchema.safeParse({ name: "AXA", id: "i1" }).success,
    ).toBe(true);
  });
});

const insurers = [
  { id: "cnss", name: "CNSS", isActive: true },
  { id: "cnops", name: "CNOPS", isActive: false },
  { id: "axa", name: "AXA", isActive: true },
];

describe("selectableInsurers", () => {
  it("offers only active insurers to a new patient", () => {
    expect(selectableInsurers(insurers, undefined).map((i) => i.id)).toEqual([
      "cnss",
      "axa",
    ]);
  });

  it("keeps the patient's current insurer even when inactive", () => {
    expect(selectableInsurers(insurers, "cnops").map((i) => i.id)).toEqual([
      "cnss",
      "cnops",
      "axa",
    ]);
  });

  it("adds nothing for a patient with no insurer", () => {
    expect(selectableInsurers(insurers, null)).toHaveLength(2);
  });
});

describe("insurerOptionLabel", () => {
  it("marks an inactive insurer", () => {
    expect(insurerOptionLabel(insurers[0])).toBe("CNSS");
    expect(insurerOptionLabel(insurers[1])).toBe("CNOPS (inactive)");
  });
});
