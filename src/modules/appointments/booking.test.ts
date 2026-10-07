import { describe, expect, it } from "vitest";

import { clinicInstant } from "@/lib/time";
import { findBookingWarnings, intervalsOverlap, type Interval } from "./booking";
import { BookingWarning } from "./types";

/** A slot on the clinic's wall clock, resolved through the clinic timezone. */
const slot = (date: string, from: string, to: string): Interval => ({
  startsAt: clinicInstant(date, from),
  endsAt: clinicInstant(date, to),
});

describe("intervalsOverlap — the half-open predicate", () => {
  const ten = slot("2026-06-15", "10:00", "11:00");

  it("10:00–11:00 and 11:00–12:00 do NOT conflict", () => {
    const eleven = slot("2026-06-15", "11:00", "12:00");
    expect(intervalsOverlap(ten, eleven)).toBe(false);
    expect(intervalsOverlap(eleven, ten)).toBe(false);
  });

  it("09:00–10:00 and 10:00–11:00 do NOT conflict", () => {
    expect(intervalsOverlap(slot("2026-06-15", "09:00", "10:00"), ten)).toBe(
      false,
    );
  });

  it("a one-minute overlap conflicts", () => {
    expect(intervalsOverlap(ten, slot("2026-06-15", "10:59", "11:30"))).toBe(
      true,
    );
  });

  it("an identical slot conflicts", () => {
    expect(intervalsOverlap(ten, slot("2026-06-15", "10:00", "11:00"))).toBe(
      true,
    );
  });

  it("a slot inside another conflicts, both ways round", () => {
    const inner = slot("2026-06-15", "10:15", "10:45");
    expect(intervalsOverlap(ten, inner)).toBe(true);
    expect(intervalsOverlap(inner, ten)).toBe(true);
  });

  it("disjoint slots do not conflict", () => {
    expect(intervalsOverlap(ten, slot("2026-06-15", "14:00", "15:00"))).toBe(
      false,
    );
  });

  it("the same wall-clock hour on different days does not conflict", () => {
    expect(intervalsOverlap(ten, slot("2026-06-16", "10:00", "11:00"))).toBe(
      false,
    );
  });
});

describe("findBookingWarnings", () => {
  // Monday 15 June 2026: 09:00–12:30 and 14:00–18:00.
  const week = [
    { weekday: 1, startTime: "09:00:00", endTime: "12:30:00" },
    { weekday: 1, startTime: "14:00:00", endTime: "18:00:00" },
  ];

  it("is silent inside a range, edges included", () => {
    expect(
      findBookingWarnings(slot("2026-06-15", "09:00", "12:30"), week, []),
    ).toEqual([]);
  });

  it("warns across the lunch break", () => {
    expect(
      findBookingWarnings(slot("2026-06-15", "12:00", "14:30"), week, []),
    ).toEqual([BookingWarning.OutsideSchedule]);
  });

  it("warns after hours", () => {
    expect(
      findBookingWarnings(slot("2026-06-15", "17:45", "18:15"), week, []),
    ).toEqual([BookingWarning.OutsideSchedule]);
  });

  it("warns on a day with no hours", () => {
    // Tuesday.
    expect(
      findBookingWarnings(slot("2026-06-16", "10:00", "10:30"), week, []),
    ).toEqual([BookingWarning.OutsideSchedule]);
  });

  it("is silent for a practitioner whose week is unconfigured", () => {
    expect(
      findBookingWarnings(slot("2026-06-16", "22:00", "22:30"), [], []),
    ).toEqual([]);
  });

  it("reads hours on the clinic wall clock during Ramadan (UTC+0)", () => {
    // Monday 2 March 2026, inside Ramadan.
    expect(
      findBookingWarnings(slot("2026-03-02", "09:00", "09:30"), week, []),
    ).toEqual([]);
    expect(
      findBookingWarnings(slot("2026-03-02", "08:30", "09:30"), week, []),
    ).toEqual([BookingWarning.OutsideSchedule]);
  });

  it("warns inside a closure, but not one that only touches the slot", () => {
    const leave = slot("2026-06-15", "11:00", "12:00");
    expect(
      findBookingWarnings(slot("2026-06-15", "10:30", "11:30"), week, [leave]),
    ).toEqual([BookingWarning.Closure]);
    expect(
      findBookingWarnings(slot("2026-06-15", "10:00", "11:00"), week, [leave]),
    ).toEqual([]);
  });

  it("reports both reasons at once", () => {
    const closedDay = {
      startsAt: clinicInstant("2026-06-15"),
      endsAt: clinicInstant("2026-06-16"),
    };
    expect(
      findBookingWarnings(slot("2026-06-15", "19:00", "19:30"), week, [
        closedDay,
      ]),
    ).toEqual([BookingWarning.OutsideSchedule, BookingWarning.Closure]);
  });
});
