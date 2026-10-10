import { describe, expect, it } from "vitest";

import { getMedicalAlertDetails, hasAlertText } from "./medical-alert";

// `MedicalAlertBadge` renders nothing exactly when `getMedicalAlertDetails`
// returns null, and prints exactly the sections it returns — these are its
// rendering rules. (The suite is `.ts` in a node environment: rendering
// itself is verified in the browser.)

describe("hasAlertText", () => {
  it("has nothing to alert on for a missing field", () => {
    expect(hasAlertText(null)).toBe(false);
    expect(hasAlertText(undefined)).toBe(false);
  });

  it("reads an empty or whitespace-only field as empty", () => {
    expect(hasAlertText("")).toBe(false);
    expect(hasAlertText("   ")).toBe(false);
    expect(hasAlertText(" \n\t ")).toBe(false);
  });

  it("alerts on any visible character", () => {
    expect(hasAlertText("Latex")).toBe(true);
    expect(hasAlertText("  x ")).toBe(true);
  });
});

describe("getMedicalAlertDetails — MedicalAlertBadge rendering rules", () => {
  it("renders nothing when both fields are empty", () => {
    expect(
      getMedicalAlertDetails({ allergies: null, medicalNotes: null }),
    ).toBeNull();
    expect(getMedicalAlertDetails({ allergies: "", medicalNotes: "" })).toBeNull();
  });

  it("renders nothing when both fields are whitespace only", () => {
    expect(
      getMedicalAlertDetails({ allergies: "  ", medicalNotes: "\n\n" }),
    ).toBeNull();
  });

  it("shows the allergies alone when there are no notes", () => {
    expect(
      getMedicalAlertDetails({ allergies: " Pénicilline ", medicalNotes: " " }),
    ).toEqual({ allergies: "Pénicilline", medicalNotes: null });
  });

  it("shows the notes alone when there is no allergy", () => {
    expect(
      getMedicalAlertDetails({
        allergies: null,
        medicalNotes: "Sous anticoagulant.",
      }),
    ).toEqual({ allergies: null, medicalNotes: "Sous anticoagulant." });
  });

  it("shows both, keeping the notes' own line breaks", () => {
    expect(
      getMedicalAlertDetails({
        allergies: "Latex",
        medicalNotes: "Diabète.\nHypertension.",
      }),
    ).toEqual({ allergies: "Latex", medicalNotes: "Diabète.\nHypertension." });
  });
});
