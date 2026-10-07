import { describe, expect, it } from "vitest";

import { formatCalendarDate } from "@/lib/format";
import { clinicInstant } from "@/lib/time";
import {
  fromFormSlot,
  toFormValues,
  type AppointmentFormSource,
} from "./form-values";

/**
 * A form saved untouched must be a no-op: startsAt → form fields → startsAt
 * is the same instant. Run it under TZ=UTC and TZ=Asia/Tokyo too
 * (prompts/18b-calendrier-fixes.md §2): nothing here may depend on the
 * machine's timezone.
 *
 * The instants are built from the clinic wall clock, never from a written
 * offset: Morocco's offset is tz-database data (UTC+1 in June 2026, UTC+0
 * during Ramadan and, per tzdata 2026c, from the autumn), and a literal would
 * rot exactly like a hardcoded "+01:00".
 */

const booking = (startsAt: Date, minutes = 30): AppointmentFormSource => ({
  patientId: "p1",
  practitionerId: "u1",
  typeId: "t1",
  startsAt,
  endsAt: new Date(startsAt.getTime() + minutes * 60_000),
  reason: null,
  notes: null,
});

const roundTrip = (source: AppointmentFormSource) => {
  const values = toFormValues(source);
  return {
    values,
    slot: fromFormSlot(values, values.durationMinutes ?? Number.NaN),
  };
};

describe("startsAt → form values → startsAt", () => {
  it.each([
    // [clinic day, clinic time]
    ["2026-06-15", "00:30"], // UTC+1: the instant is on the previous UTC day
    ["2026-06-15", "09:15"],
    ["2026-06-15", "23:45"],
    ["2026-10-02", "00:30"], // the reported Friday
    ["2026-10-02", "09:15"],
    ["2026-10-02", "23:45"],
    ["2026-03-05", "00:30"], // inside Ramadan
    ["2026-03-05", "09:15"],
    ["2026-03-05", "23:45"],
  ])(
    "%s %s reads back as itself and saves to the same instant",
    (day, time) => {
      const source = booking(clinicInstant(day, time), 45);
      const { values, slot } = roundTrip(source);

      expect(values.date).toBe(day);
      expect(values.time).toBe(time);
      expect(values.durationMinutes).toBe(45);
      expect(slot.startsAt.getTime()).toBe(source.startsAt.getTime());
      expect(slot.endsAt.getTime()).toBe(source.endsAt.getTime());
    },
  );

  it("puts a 00:30 June booking on the clinic day, not the UTC one", () => {
    // Fixed instant: 23:30Z on the 14th is 00:30 on the 15th in Casablanca.
    const { values } = roundTrip(booking(new Date("2026-06-14T23:30:00Z")));
    expect(values.date).toBe("2026-06-15");
    expect(values.time).toBe("00:30");
  });

  it("shows the clinic day on the date button, not the browser's", () => {
    // Friday 2 Oct 09:15 in the clinic: the button reads 02/10/2026, never
    // the 01/10 a browser east of Casablanca produced through a Date.
    const { values } = roundTrip(booking(clinicInstant("2026-10-02", "09:15")));
    expect(formatCalendarDate(values.date)).toBe("02/10/2026");
  });
});

describe("create mode", () => {
  it("takes the slot, practitioner and patient from the defaults", () => {
    const values = toFormValues(undefined, {
      date: "2026-10-05",
      time: "10:00",
      practitionerId: "u2",
      patient: { id: "p9", shortCode: "AB12", firstName: "A", lastName: "B" },
    });
    expect(values).toMatchObject({
      date: "2026-10-05",
      time: "10:00",
      practitionerId: "u2",
      patientId: "p9",
      typeId: null,
    });
  });
});
