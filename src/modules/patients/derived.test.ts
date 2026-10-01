import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatPatientName,
  formatPregnancyTerm,
  getCurrentPregnancyWeeks,
  getMedicalAlerts,
  getPatientAge,
  getPaymentStatus,
  isMedicalCondition,
} from "./derived";
import { MedicalAlert, PaymentStatus } from "./types";

const status = (total: number, paid: number) =>
  getPaymentStatus({
    totalAmountCents: total,
    amountPaidCents: paid,
    remainingCents: total - paid,
  });

describe("getPaymentStatus", () => {
  it("reads a new dossier with nothing billed as «Aucun acte»", () => {
    expect(status(0, 0)).toBe(PaymentStatus.NoCharges);
  });

  it("reads a settled balance as «Payé»", () => {
    expect(status(125000, 125000)).toBe(PaymentStatus.Paid);
  });

  it("reads a billed patient who has paid nothing as «Impayé»", () => {
    expect(status(125000, 0)).toBe(PaymentStatus.Unpaid);
  });

  it("reads a part-payment as «Reste à payer»", () => {
    expect(status(125000, 50000)).toBe(PaymentStatus.Partial);
  });

  it("reads an overpayment as «Avance» rather than clamping it", () => {
    expect(status(125000, 150000)).toBe(PaymentStatus.Advance);
  });

  it("reads a payment taken before anything was billed as «Avance»", () => {
    expect(status(0, 50000)).toBe(PaymentStatus.Advance);
  });

  it("follows the procedure's remaining figure, not arithmetic repeated here", () => {
    expect(
      getPaymentStatus({
        totalAmountCents: 125000,
        amountPaidCents: 0,
        remainingCents: -1,
      }),
    ).toBe(PaymentStatus.Advance);
  });
});

describe("getPatientAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has no age for a patient whose birth date is unknown", () => {
    expect(getPatientAge(null)).toBeNull();
  });

  it("refuses an unparseable date instead of reporting NaN", () => {
    expect(getPatientAge("pas-une-date")).toBeNull();
  });

  it("counts whole years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    expect(getPatientAge("1988-07-05")).toBe(38);
  });

  it("does not count a birthday that has not arrived yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    expect(getPatientAge("1988-12-31")).toBe(37);
  });

  it("reads the day boundary on the clinic clock, not the server's", () => {
    // 23:30 UTC on the 4th is already the 5th in Casablanca (UTC+1), so a
    // patient born on 5 July turns a year older here and not an hour later.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T23:30:00Z"));
    expect(getPatientAge("1988-07-05")).toBe(38);
  });
});

describe("formatPatientName", () => {
  it("puts the upper-cased surname first, the way the clinic files it", () => {
    expect(
      formatPatientName({ firstName: "Karim", lastName: "Benali" }),
    ).toBe("BENALI Karim");
  });

  it("upper-cases accented surnames without stripping the accent", () => {
    expect(
      formatPatientName({ firstName: "Hicham", lastName: "Bénali" }),
    ).toBe("BÉNALI Hicham");
  });
});

describe("getCurrentPregnancyWeeks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has no term when none was recorded", () => {
    expect(getCurrentPregnancyWeeks(null, new Date())).toBeNull();
  });

  it("ages the recorded term by the whole weeks elapsed since", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:00Z"));
    // Recorded 20 days ago: two whole weeks, the third is not over yet.
    expect(
      getCurrentPregnancyWeeks(12, new Date("2026-09-05T10:00:00Z")),
    ).toBe(14);
  });

  it("never runs the term backwards for a save stamped in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:00Z"));
    expect(
      getCurrentPregnancyWeeks(12, new Date("2026-10-25T10:00:00Z")),
    ).toBe(12);
  });
});

describe("formatPregnancyTerm", () => {
  it("prints the term in semaines d’aménorrhée", () => {
    expect(formatPregnancyTerm(14)).toBe("14 SA");
  });

  it("asks for a check instead of printing an impossible term", () => {
    expect(formatPregnancyTerm(42)).toBe("42 SA");
    expect(formatPregnancyTerm(43)).toBe("terme à vérifier");
  });

  it("has nothing to print when the term is unknown", () => {
    expect(formatPregnancyTerm(null)).toBeNull();
  });
});

describe("getMedicalAlerts", () => {
  const clean = {
    onAnticoagulants: false,
    onBisphosphonates: false,
    needsAntibioticProphylaxis: false,
    isPregnant: null,
    pregnancyWeeks: null,
    updatedAt: new Date(),
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no pill for a dossier never filled in", () => {
    expect(getMedicalAlerts(null)).toEqual([]);
  });

  it("shows no pill for a filled dossier with nothing critical", () => {
    expect(getMedicalAlerts(clean)).toEqual([]);
  });

  it("shows one pill per critical flag, in a fixed order", () => {
    const alerts = getMedicalAlerts({
      ...clean,
      needsAntibioticProphylaxis: true,
      onAnticoagulants: true,
      onBisphosphonates: true,
    });
    expect(alerts.map(({ alert }) => alert)).toEqual([
      MedicalAlert.Anticoagulants,
      MedicalAlert.Bisphosphonates,
      MedicalAlert.AntibioticProphylaxis,
    ]);
    expect(alerts.map(({ label }) => label)).toEqual([
      "Anticoagulants",
      "Bisphosphonates",
      "Antibioprophylaxie",
    ]);
  });

  it("spells out the current term on the pregnancy pill", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:00Z"));
    expect(
      getMedicalAlerts({
        ...clean,
        isPregnant: true,
        pregnancyWeeks: 12,
        updatedAt: new Date("2026-09-11T10:00:00Z"),
      }),
    ).toEqual([{ alert: MedicalAlert.Pregnancy, label: "Enceinte (14 SA)" }]);
  });

  it("still shows the pregnancy pill when the term is unknown", () => {
    expect(getMedicalAlerts({ ...clean, isPregnant: true })).toEqual([
      { alert: MedicalAlert.Pregnancy, label: "Enceinte" },
    ]);
  });

  it("reads «non renseigné» as no pill, not as a pregnancy", () => {
    expect(
      getMedicalAlerts({ ...clean, isPregnant: null, pregnancyWeeks: 20 }),
    ).toEqual([]);
  });
});

describe("isMedicalCondition", () => {
  it("accepts a key from the list", () => {
    expect(isMedicalCondition("diabetes")).toBe(true);
  });

  it("skips a key that is not, or no longer, in the list", () => {
    expect(isMedicalCondition("scurvy")).toBe(false);
  });
});
