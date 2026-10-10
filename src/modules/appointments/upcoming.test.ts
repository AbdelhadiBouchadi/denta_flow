import { describe, expect, it } from "vitest";

import { AppointmentStatus } from "./types";
import {
  isUpcomingAppointment,
  selectUpcomingAppointments,
  UPCOMING_APPOINTMENT_STATUSES,
  UPCOMING_APPOINTMENTS_LIMIT,
} from "./upcoming";

const NOW = new Date("2026-10-09T10:00:00Z");
const at = (iso: string) => new Date(iso);

const booking = (
  id: string,
  status: AppointmentStatus,
  startsAt: string,
  endsAt: string,
) => ({ id, status, startsAt: at(startsAt), endsAt: at(endsAt) });

describe("isUpcomingAppointment", () => {
  it("lists planned, confirmed and arrived only", () => {
    expect([...UPCOMING_APPOINTMENT_STATUSES].sort()).toEqual(
      [
        AppointmentStatus.Arrived,
        AppointmentStatus.Confirmed,
        AppointmentStatus.Planned,
      ].sort(),
    );
  });

  it.each([
    AppointmentStatus.Completed,
    AppointmentStatus.Canceled,
    AppointmentStatus.NoShow,
  ])("excludes a terminal booking (%s), even in the future", (status) => {
    expect(
      isUpcomingAppointment(
        { status, endsAt: at("2026-10-20T10:30:00Z") },
        NOW,
      ),
    ).toBe(false);
  });

  it("excludes a booking already over", () => {
    expect(
      isUpcomingAppointment(
        {
          status: AppointmentStatus.Confirmed,
          endsAt: at("2026-10-09T09:30:00Z"),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("keeps the patient in the waiting room for a slot that has begun", () => {
    expect(
      isUpcomingAppointment(
        {
          status: AppointmentStatus.Arrived,
          endsAt: at("2026-10-09T10:15:00Z"),
        },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("selectUpcomingAppointments", () => {
  it("keeps the next three, soonest first", () => {
    const items = [
      booking("e", AppointmentStatus.Planned, "2026-11-01T09:00:00Z", "2026-11-01T09:30:00Z"),
      booking("past", AppointmentStatus.Planned, "2026-10-01T09:00:00Z", "2026-10-01T09:30:00Z"),
      booking("done", AppointmentStatus.Completed, "2026-10-10T09:00:00Z", "2026-10-10T09:30:00Z"),
      booking("c", AppointmentStatus.Confirmed, "2026-10-12T09:00:00Z", "2026-10-12T09:30:00Z"),
      booking("a", AppointmentStatus.Arrived, "2026-10-09T09:45:00Z", "2026-10-09T10:15:00Z"),
      booking("cancel", AppointmentStatus.Canceled, "2026-10-11T09:00:00Z", "2026-10-11T09:30:00Z"),
      booking("d", AppointmentStatus.Planned, "2026-10-15T09:00:00Z", "2026-10-15T09:30:00Z"),
    ];
    const selected = selectUpcomingAppointments(items, NOW);
    expect(selected).toHaveLength(UPCOMING_APPOINTMENTS_LIMIT);
    expect(selected.map(({ id }) => id)).toEqual(["a", "c", "d"]);
  });

  it("breaks a tie on the start by id, like the SQL", () => {
    const items = [
      booking("b", AppointmentStatus.Planned, "2026-10-12T09:00:00Z", "2026-10-12T09:30:00Z"),
      booking("a", AppointmentStatus.Planned, "2026-10-12T09:00:00Z", "2026-10-12T09:30:00Z"),
    ];
    expect(selectUpcomingAppointments(items, NOW).map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("is empty when nothing is ahead", () => {
    expect(selectUpcomingAppointments([], NOW)).toEqual([]);
  });
});
