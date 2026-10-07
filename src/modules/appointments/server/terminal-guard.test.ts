import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { AppointmentStatus } from "../types";
import { assertEditableBooking, type BookingCore } from "./terminal-guard";

const existing: BookingCore = {
  patientId: "p1",
  practitionerId: "u1",
  typeId: "t1",
  startsAt: new Date("2026-10-02T08:15:00Z"),
  endsAt: new Date("2026-10-02T08:45:00Z"),
};

const TERMINAL = [
  AppointmentStatus.Completed,
  AppointmentStatus.Canceled,
  AppointmentStatus.NoShow,
];

const OPEN = [
  AppointmentStatus.Planned,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
];

const CHANGES: [string, Partial<BookingCore>][] = [
  [
    "the time",
    {
      startsAt: new Date("2026-10-02T09:15:00Z"),
      endsAt: new Date("2026-10-02T09:45:00Z"),
    },
  ],
  ["the duration", { endsAt: new Date("2026-10-02T09:00:00Z") }],
  ["the practitioner", { practitionerId: "u2" }],
  ["the type", { typeId: null }],
  ["the patient", { patientId: "p2" }],
];

const rejection = (status: AppointmentStatus, next: BookingCore) => {
  try {
    assertEditableBooking(status, existing, next);
  } catch (error) {
    return error;
  }
  return null;
};

describe("a terminal appointment", () => {
  describe.each(TERMINAL)("%s", (status) => {
    it.each(CHANGES)("rejects a change to %s with BAD_REQUEST", (_, change) => {
      const error = rejection(status, { ...existing, ...change });
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
      expect((error as TRPCError).message).toMatch(
        /seuls le motif et les notes peuvent encore être modifiés/,
      );
    });

    it("still saves reason / notes — the booking itself is unchanged", () => {
      // Same instants, rebuilt: compared by value, not by reference.
      const next = {
        ...existing,
        startsAt: new Date(existing.startsAt.getTime()),
        endsAt: new Date(existing.endsAt.getTime()),
      };
      expect(rejection(status, next)).toBeNull();
    });
  });

  it("names the status in French in the message", () => {
    const error = rejection(AppointmentStatus.Completed, {
      ...existing,
      practitionerId: "u2",
    }) as TRPCError;
    expect(error.message).toContain("Terminé");
  });
});

describe("an open appointment", () => {
  it.each(OPEN)("%s can still be moved and reassigned", (status) => {
    for (const [, change] of CHANGES) {
      expect(rejection(status, { ...existing, ...change })).toBeNull();
    }
  });
});
