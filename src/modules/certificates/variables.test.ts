import { describe, expect, it } from "vitest";

import { CERTIFICATE_RENDER_ERRORS as E } from "./constants";
import {
  buildCertificateValues,
  countDaysInclusive,
  renderCertificateBody,
  resolveCertificatePeriod,
  templateBodyError,
  usesPeriod,
  type CertificateValues,
} from "./variables";

const values: CertificateValues = {
  patient: "BENALI Karim",
  cin: "AB123456",
  date: "lundi 12 octobre 2026",
  debut: "12/10/2026",
  fin: "14/10/2026",
  jours: "3",
  praticien: "Dr Test",
};

describe("renderCertificateBody", () => {
  it("resolves every variable, spaces inside braces tolerated", () => {
    const body = [
      "Je soussigné(e), {{praticien}}, certifie avoir examiné {{ patient }},",
      "CIN : {{cin}},",
      "le {{date}}. Repos de {{jours}} jours, du {{debut}} au {{fin}}.",
    ].join("\n");
    expect(renderCertificateBody(body, values)).toEqual({
      ok: true,
      text: [
        "Je soussigné(e), Dr Test, certifie avoir examiné BENALI Karim,",
        "CIN : AB123456,",
        "le lundi 12 octobre 2026. Repos de 3 jours, du 12/10/2026 au 14/10/2026.",
      ].join("\n"),
    });
  });

  it("removes the whole {{cin}} line when the patient has no CIN", () => {
    const result = renderCertificateBody("{{patient}}\nCIN : {{cin}}\nFin.", {
      ...values,
      cin: null,
    });
    expect(result).toEqual({ ok: true, text: "BENALI Karim\nFin." });
  });

  it("refuses a variable without a value, naming it", () => {
    const result = renderCertificateBody("Du {{debut}} au {{fin}}.", {
      ...values,
      debut: null,
    });
    expect(result).toEqual({ ok: false, error: E.missing("debut") });
    expect(!result.ok && result.error).toContain("{{debut}}");
  });

  it("refuses an unknown variable, naming it", () => {
    const result = renderCertificateBody("Bonjour {{inconnu}}.", values);
    expect(result).toEqual({ ok: false, error: E.unknown("inconnu") });
    expect(!result.ok && result.error).toContain("{{inconnu}}");
  });

  it("refuses stray braces left in the text", () => {
    expect(renderCertificateBody("Texte {{ patient", values)).toEqual({
      ok: false,
      error: E.malformed,
    });
  });

  it("keeps line breaks, renders no markup and caps the length", () => {
    expect(renderCertificateBody("<b>a</b>\n\n*b*", values)).toEqual({
      ok: true,
      text: "<b>a</b>\n\n*b*",
    });
    expect(renderCertificateBody("x".repeat(4001), values)).toEqual({
      ok: false,
      error: E.tooLong,
    });
  });
});

describe("resolveCertificatePeriod", () => {
  it("computes jours from the range, both days counted, ignoring the client's", () => {
    expect(
      resolveCertificatePeriod({
        startDate: "2026-10-12",
        endDate: "2026-10-14",
        days: 99,
      }),
    ).toEqual({
      ok: true,
      period: { startDate: "2026-10-12", endDate: "2026-10-14", days: 3 },
    });
  });

  it("counts across a month end and a clock change without drift", () => {
    expect(countDaysInclusive("2026-10-30", "2026-11-02")).toBe(4);
    expect(countDaysInclusive("2026-03-01", "2026-03-31")).toBe(31);
    expect(countDaysInclusive("2026-10-12", "2026-10-12")).toBe(1);
  });

  it("refuses fin < debut", () => {
    expect(
      resolveCertificatePeriod({ startDate: "2026-10-14", endDate: "2026-10-12" }),
    ).toEqual({ ok: false, error: E.rangeInverted });
  });

  it("uses the client's days only without a range", () => {
    expect(resolveCertificatePeriod({ days: 2 })).toEqual({
      ok: true,
      period: { startDate: null, endDate: null, days: 2 },
    });
  });
});

describe("buildCertificateValues", () => {
  it("formats the patient, the dates and the practitioner", () => {
    const built = buildCertificateValues({
      patient: { firstName: "Karim", lastName: "Benali", cin: " " },
      practitionerName: "Dr Test",
      issuedAt: new Date("2026-10-12T09:00:00Z"),
      period: { startDate: "2026-10-12", endDate: "2026-10-14", days: 3 },
    });
    expect(built).toEqual({
      patient: "BENALI Karim",
      cin: null,
      date: "lundi 12 octobre 2026",
      debut: "12/10/2026",
      fin: "14/10/2026",
      jours: "3",
      praticien: "Dr Test",
    });
  });
});

describe("template bodies", () => {
  it("accepts known variables, refuses unknown ones and stray braces", () => {
    expect(templateBodyError("{{patient}} le {{date}}")).toBeNull();
    expect(templateBodyError("{{nom}}")).toBe(E.unknown("nom"));
    expect(templateBodyError("{{patient}} }}")).toBe(E.malformed);
  });

  it("knows when a body needs the period fields", () => {
    expect(usesPeriod("Repos de {{jours}} jours")).toBe(true);
    expect(usesPeriod("{{patient}} est venu le {{date}}")).toBe(false);
  });
});
