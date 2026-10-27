import { describe, expect, it } from "vitest";

import { addCalendarDays, clinicInstant } from "@/lib/time";
import { DEFAULT_MANUAL_TEXTS } from "./constants";
import {
  buildMessageParams,
  formatClinicPhone,
  renderManualText,
  toContentVariables,
} from "./message";
import { WhatsappEvent } from "./types";

const params = (startsAt: Date) =>
  buildMessageParams({
    firstName: "  Karim ",
    startsAt,
    clinicName: "Cabinet Dentaire Dr Amrani",
    clinicPhone: "+212528843217",
  });

describe("buildMessageParams", () => {
  it("carries the first name only, the long French date and the time", () => {
    expect(params(clinicInstant("2026-10-14", "14:30"))).toEqual({
      firstName: "Karim",
      date: "mercredi 14 octobre",
      time: "14:30",
      clinicName: "Cabinet Dentaire Dr Amrani",
      clinicPhone: "05 28 84 32 17",
    });
  });

  it("reads 23:30 and 00:30 on the clinic's own day", () => {
    expect(params(clinicInstant("2026-10-14", "23:30"))).toMatchObject({
      date: "mercredi 14 octobre",
      time: "23:30",
    });
    expect(params(clinicInstant("2026-10-15", "00:30"))).toMatchObject({
      date: "jeudi 15 octobre",
      time: "00:30",
    });
  });

  it("reads the wall clock on both sides of a clock change", () => {
    let day = "2026-01-01";
    while (clinicInstant(day, "12:00").getUTCHours() !== 12) {
      day = addCalendarDays(day, 1);
    }
    expect(params(clinicInstant(day, "10:00")).time).toBe("10:00");
    expect(params(clinicInstant(addCalendarDays(day, -1), "10:00")).time).toBe("10:00");
  });
});

describe("toContentVariables", () => {
  it("is the JSON string Twilio expects, keys 1 to 5", () => {
    const json = toContentVariables(params(clinicInstant("2026-10-14", "14:30")));
    expect(JSON.parse(json)).toEqual({
      "1": "Karim",
      "2": "mercredi 14 octobre",
      "3": "14:30",
      "4": "Cabinet Dentaire Dr Amrani",
      "5": "05 28 84 32 17",
    });
    expect(json.startsWith('{"1":')).toBe(true);
  });
});

describe("renderManualText", () => {
  it("replaces every token", () => {
    const text = renderManualText(
      DEFAULT_MANUAL_TEXTS[WhatsappEvent.Reminder],
      params(clinicInstant("2026-10-14", "14:30")),
    );
    expect(text).toBe(
      "Bonjour Karim, nous vous rappelons votre rendez-vous le mercredi 14 octobre à 14:30 au Cabinet Dentaire Dr Amrani. Pour le modifier ou l’annuler, appelez le 05 28 84 32 17.",
    );
    expect(text).not.toMatch(/\{\w+\}/);
  });
});

describe("formatClinicPhone", () => {
  it.each([
    ["+212528843217", "05 28 84 32 17"],
    ["0528843217", "05 28 84 32 17"],
    ["+33 1 23 45 67 89", "+33 1 23 45 67 89"],
  ])("%s → %s", (raw, expected) => {
    expect(formatClinicPhone(raw)).toBe(expected);
  });
});
