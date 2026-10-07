import { describe, expect, it } from "vitest";

import { CalendarView } from "../types";
import {
  ALL_PRACTITIONERS,
  calendarQueryInput,
  defaultCalendarPractitioner,
  resolveCalendarPractitioner,
  toPractitionerParam,
} from "./calendar-query";

describe("defaultCalendarPractitioner", () => {
  it("defaults an active dentist or admin to themselves", () => {
    expect(
      defaultCalendarPractitioner({
        id: "u1",
        role: "dentist",
        isActive: true,
      }),
    ).toBe("u1");
    expect(
      defaultCalendarPractitioner({ id: "u1", role: "admin", isActive: true }),
    ).toBe("u1");
  });

  it("shows everybody to anyone else", () => {
    expect(
      defaultCalendarPractitioner({
        id: "u1",
        role: "assistant",
        isActive: true,
      }),
    ).toBe("");
    expect(
      defaultCalendarPractitioner({
        id: "u1",
        role: "dentist",
        isActive: false,
      }),
    ).toBe("");
  });
});

describe("practitioner filter ⇄ URL", () => {
  it.each([
    // [URL value, default, shown]
    ["", "u1", "u1"],
    ["", "", ""],
    [ALL_PRACTITIONERS, "u1", ""],
    ["u2", "u1", "u2"],
  ])("URL %j with default %j shows %j", (param, fallback, shown) => {
    expect(resolveCalendarPractitioner(param, fallback)).toBe(shown);
  });

  it.each([
    ["u1", "u1"],
    ["", "u1"],
    ["u2", "u1"],
    ["", ""],
    ["u2", ""],
  ])("picking %j with default %j round-trips", (picked, fallback) => {
    expect(
      resolveCalendarPractitioner(
        toPractitionerParam(picked, fallback),
        fallback,
      ),
    ).toBe(picked);
  });

  it("keeps the URL clean for the default", () => {
    expect(toPractitionerParam("u1", "u1")).toBe("");
    expect(toPractitionerParam("", "")).toBe("");
  });
});

describe("calendarQueryInput", () => {
  it("passes date and view through raw, the practitioner resolved", () => {
    expect(
      calendarQueryInput(
        { date: "", view: CalendarView.Week, practitionerId: "" },
        "u1",
      ),
    ).toEqual({ date: "", view: CalendarView.Week, practitionerId: "u1" });
  });
});
