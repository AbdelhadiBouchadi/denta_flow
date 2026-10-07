import { describe, expect, it } from "vitest";

import { treatmentStatus } from "@/database/schema";
import { BILLABLE_TREATMENT_STATUSES } from "@/database/sql/billable";
import { formatTooth } from "@/lib/format";
import { toClinicDate, toClinicWallClock } from "@/lib/time";
import { ALL_TEETH } from "@/modules/odontogram/constants";
import { TREATMENT_VALIDATION_MESSAGES as M } from "./constants";
import { resolvePerformedAt } from "./form-values";
import { treatmentFormSchema, treatmentUpdateSchema } from "./schemas";
import { matchesTreatmentSearch } from "./search";
import {
  CHART_LAYOUT,
  formatTeethList,
  initialDentition,
  splitVisibleTeeth,
  suggestedTotalCents,
} from "./teeth";
import { Dentition, TreatmentStatus } from "./types";

const valid = {
  patientId: "p1",
  serviceId: "s1",
  label: "Composite 2 faces",
  nomenclatureCode: "D701",
  teeth: ["26"],
  totalAmountCents: 30000,
  status: TreatmentStatus.Completed,
  practitionerId: "u1",
  appointmentId: null,
  performedDate: "2026-10-05",
  performedTime: "10:30",
  notes: "",
};

const issues = (input: unknown) => {
  const result = treatmentFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues;
};
const firstMessage = (input: unknown) => issues(input)[0]?.message ?? null;

describe("treatmentFormSchema — teeth", () => {
  it("accepts an acte with no tooth (consultation, scaling, panoramic)", () => {
    expect(treatmentFormSchema.parse({ ...valid, teeth: [] }).teeth).toEqual([]);
    expect(
      treatmentFormSchema.parse({ ...valid, teeth: undefined }).teeth,
    ).toEqual([]);
  });

  it("rejects a code that is not FDI", () => {
    expect(firstMessage({ ...valid, teeth: ["19"] })).toBe(M.toothInvalid);
    expect(firstMessage({ ...valid, teeth: ["1"] })).toBe(M.toothInvalid);
    expect(firstMessage({ ...valid, teeth: ["56"] })).toBe(M.toothInvalid);
  });

  it("drops duplicates and sorts, adult and child mixed", () => {
    expect(
      treatmentFormSchema.parse({ ...valid, teeth: ["27", "55", "26", "27"] })
        .teeth,
    ).toEqual(["26", "27", "55"]);
  });

  it("covers exactly the 52 FDI codes", () => {
    expect(ALL_TEETH).toHaveLength(52);
    expect(new Set(ALL_TEETH).size).toBe(52);
  });
});

describe("treatmentFormSchema — amount, label, dates", () => {
  it("requires an integer amount ≥ 0", () => {
    expect(treatmentFormSchema.parse({ ...valid, totalAmountCents: 0 })
      .totalAmountCents).toBe(0);
    expect(firstMessage({ ...valid, totalAmountCents: -1 })).toBe(
      M.amountInvalid,
    );
    expect(firstMessage({ ...valid, totalAmountCents: 10.5 })).toBe(
      M.amountInvalid,
    );
    expect(firstMessage({ ...valid, totalAmountCents: null })).toBe(
      M.amountInvalid,
    );
  });

  it("trims the label and requires it", () => {
    expect(treatmentFormSchema.parse({ ...valid, label: "  Pose  " }).label).toBe(
      "Pose",
    );
    expect(firstMessage({ ...valid, label: "   " })).toBe(M.labelRequired);
  });

  it("reads empty optional fields as null", () => {
    const parsed = treatmentFormSchema.parse({
      ...valid,
      serviceId: "",
      practitionerId: "",
      nomenclatureCode: "  ",
    });
    expect(parsed.serviceId).toBeNull();
    expect(parsed.practitionerId).toBeNull();
    expect(parsed.nomenclatureCode).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("wants a date and a time together, or neither", () => {
    expect(
      issues({ ...valid, performedTime: "" }).map((issue) => issue.message),
    ).toEqual([M.timeRequired]);
    expect(
      issues({ ...valid, performedDate: "" }).map((issue) => issue.message),
    ).toEqual([M.dateRequired]);
    expect(
      treatmentFormSchema.safeParse({
        ...valid,
        performedDate: "",
        performedTime: "",
      }).success,
    ).toBe(true);
  });

  it("carries the version token on update", () => {
    const at = new Date("2026-10-05T09:00:00.123Z");
    const parsed = treatmentUpdateSchema.parse({
      ...valid,
      id: "t1",
      expectedUpdatedAt: at,
    });
    expect(parsed.id).toBe("t1");
    expect(parsed.expectedUpdatedAt).toEqual(at);
    expect(
      treatmentUpdateSchema.safeParse({ ...valid, id: "t1" }).success,
    ).toBe(false);
  });
});

describe("statuses", () => {
  it("mirrors the treatment_status pgEnum", () => {
    expect(Object.values(TreatmentStatus).sort()).toEqual(
      [...treatmentStatus.enumValues].sort(),
    );
  });

  it("bills only in-progress and completed actes", () => {
    expect([...BILLABLE_TREATMENT_STATUSES].sort()).toEqual(
      [TreatmentStatus.Completed, TreatmentStatus.InProgress].sort(),
    );
  });
});

describe("teeth helpers", () => {
  it("formats a tooth and a list", () => {
    expect(formatTooth("26")).toBe("Dent 26");
    expect(formatTeethList(["26", "27"])).toBe("Dent 26, Dent 27");
  });

  it("shows three teeth, then +N", () => {
    expect(splitVisibleTeeth(["11", "12", "13", "14", "15"])).toEqual({
      visible: ["11", "12", "13"],
      hidden: 2,
    });
    expect(splitVisibleTeeth(["11", "12", "13"]).hidden).toBe(0);
  });

  it("suggests price × teeth, no tooth counting as one", () => {
    expect(suggestedTotalCents(30000, 3)).toBe(90000);
    expect(suggestedTotalCents(30000, 1)).toBe(30000);
    expect(suggestedTotalCents(30000, 0)).toBe(30000);
  });

  it("lays the chart out patient's right on the left", () => {
    expect(CHART_LAYOUT[Dentition.Adult].upper.right[0]).toBe("18");
    expect(CHART_LAYOUT[Dentition.Adult].upper.left[0]).toBe("21");
    expect(CHART_LAYOUT[Dentition.Adult].lower.right[0]).toBe("48");
    expect(CHART_LAYOUT[Dentition.Child].upper.right).toEqual([
      "55", "54", "53", "52", "51",
    ]);
  });

  it("opens on the child chart only for milk teeth alone", () => {
    expect(initialDentition([])).toBe(Dentition.Adult);
    expect(initialDentition(["55", "61"])).toBe(Dentition.Child);
    expect(initialDentition(["55", "26"])).toBe(Dentition.Adult);
  });
});

describe("resolvePerformedAt", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("reads the date and time on the clinic's wall clock", () => {
    // Asserted as a round-trip, never as an offset: Morocco's offset moves.
    const at = resolvePerformedAt(
      {
        performedDate: "2026-10-05",
        performedTime: "10:30",
        status: TreatmentStatus.InProgress,
      },
      now,
    );
    expect(at).not.toBeNull();
    expect(toClinicDate(at!)).toBe("2026-10-05");
    expect(toClinicWallClock(at!)).toBe("10:30");
  });

  it("dates an undated completed acte now, leaves the others undated", () => {
    const blank = { performedDate: "", performedTime: "" };
    expect(
      resolvePerformedAt({ ...blank, status: TreatmentStatus.Completed }, now),
    ).toBe(now);
    expect(
      resolvePerformedAt({ ...blank, status: TreatmentStatus.Planned }, now),
    ).toBeNull();
  });
});

describe("matchesTreatmentSearch", () => {
  it("is case- and accent-insensitive, and matches the code", () => {
    const acte = { label: "Détartrage", nomenclatureCode: "D708" };
    expect(matchesTreatmentSearch(acte, "detartrage")).toBe(true);
    expect(matchesTreatmentSearch(acte, "d708")).toBe(true);
    expect(matchesTreatmentSearch(acte, "")).toBe(true);
    expect(matchesTreatmentSearch(acte, "couronne")).toBe(false);
  });
});
