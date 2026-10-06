import { describe, expect, it } from "vitest";

import { canTransition, isTerminalStatus, nextStatuses } from "./status";
import { AppointmentStatus } from "./types";

const {
  Planned,
  Confirmed,
  Arrived,
  Completed,
  Canceled,
  NoShow,
} = AppointmentStatus;

const ALL = Object.values(AppointmentStatus);

/** The full matrix, written out by hand: every pair not listed is illegal. */
const LEGAL: [AppointmentStatus, AppointmentStatus][] = [
  [Planned, Confirmed],
  [Planned, Canceled],
  [Planned, NoShow],
  [Confirmed, Arrived],
  [Confirmed, Canceled],
  [Confirmed, NoShow],
  [Arrived, Completed],
  [Arrived, Canceled],
];

const isListedLegal = (from: AppointmentStatus, to: AppointmentStatus) =>
  LEGAL.some(([a, b]) => a === from && b === to);

describe("canTransition — the full 6×6 matrix", () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const expected = isListedLegal(from, to);
      it(`${from} → ${to} is ${expected ? "legal" : "illegal"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("the happy path", () => {
  it("walks planned → confirmed → arrived → completed", () => {
    expect(canTransition(Planned, Confirmed)).toBe(true);
    expect(canTransition(Confirmed, Arrived)).toBe(true);
    expect(canTransition(Arrived, Completed)).toBe(true);
  });

  it("never skips a step or goes backwards", () => {
    expect(canTransition(Planned, Arrived)).toBe(false);
    expect(canTransition(Planned, Completed)).toBe(false);
    expect(canTransition(Confirmed, Completed)).toBe(false);
    expect(canTransition(Arrived, Confirmed)).toBe(false);
    expect(canTransition(Completed, Arrived)).toBe(false);
  });

  it("rejects a no-op transition", () => {
    for (const status of ALL) expect(canTransition(status, status)).toBe(false);
  });
});

describe("terminal states", () => {
  it.each([Canceled, NoShow, Completed])("%s has no way out", (status) => {
    expect(isTerminalStatus(status)).toBe(true);
    expect(nextStatuses(status)).toEqual([]);
  });

  it.each([Planned, Confirmed, Arrived])("%s is still open", (status) => {
    expect(isTerminalStatus(status)).toBe(false);
  });

  it("cannot reopen a canceled appointment", () => {
    for (const to of ALL) expect(canTransition(Canceled, to)).toBe(false);
  });

  it("cannot mark a patient already in the waiting room as absent", () => {
    expect(canTransition(Arrived, NoShow)).toBe(false);
  });
});
