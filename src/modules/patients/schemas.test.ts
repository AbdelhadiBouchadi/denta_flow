import { describe, expect, it } from "vitest";

import { medicalHistorySchema } from "./schemas";

/** An untouched form, as `toFormValues` builds it for a new dossier. */
const blank = {
  conditions: [],
  onAnticoagulants: false,
  onBisphosphonates: false,
  needsAntibioticProphylaxis: false,
  isPregnant: null,
  pregnancyWeeks: null,
  isBreastfeeding: null,
  currentMedications: "",
  surgicalHistory: "",
  anesthesiaReactions: "",
  smoking: "none",
  bruxism: false,
  bloodType: null,
  primaryDoctorName: "",
  primaryDoctorPhone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
};

describe("medicalHistorySchema", () => {
  it("stores an untouched text field as null, never as an empty string", () => {
    const parsed = medicalHistorySchema.parse(blank);
    expect(parsed.currentMedications).toBeNull();
    expect(parsed.emergencyContactPhone).toBeNull();
  });

  it("deduplicates conditions and puts them back in canonical order", () => {
    const parsed = medicalHistorySchema.parse({
      ...blank,
      conditions: ["osteoporosis", "diabetes", "osteoporosis"],
    });
    expect(parsed.conditions).toEqual(["diabetes", "osteoporosis"]);
  });

  it("rejects a condition key outside the list", () => {
    const result = medicalHistorySchema.safeParse({
      ...blank,
      conditions: ["scurvy"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a term from 1 to 42 weeks and nothing else", () => {
    const withWeeks = (pregnancyWeeks: number) =>
      medicalHistorySchema.safeParse({
        ...blank,
        isPregnant: true,
        pregnancyWeeks,
      }).success;

    expect(withWeeks(1)).toBe(true);
    expect(withWeeks(42)).toBe(true);
    expect(withWeeks(0)).toBe(false);
    expect(withWeeks(43)).toBe(false);
    expect(withWeeks(12.5)).toBe(false);
    expect(withWeeks(Number.NaN)).toBe(false);
  });

  it("stores a local emergency number in E.164", () => {
    const parsed = medicalHistorySchema.parse({
      ...blank,
      emergencyContactPhone: "0612345678",
    });
    expect(parsed.emergencyContactPhone).toBe("+212612345678");
  });
});
