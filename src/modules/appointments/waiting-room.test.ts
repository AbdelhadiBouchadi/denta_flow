import { describe, expect, it } from "vitest";

import { formatWaitingTime } from "./constants";
import { APPOINTMENT_STATUS_TRANSITIONS } from "./status";
import { AppointmentStatus } from "./types";
import {
  arrivedAtFor,
  WAITING_DANGER_MINUTES,
  WAITING_WARNING_MINUTES,
  waitingMinutes,
  waitingTone,
} from "./waiting-room";

describe("formatWaitingTime", () => {
  it.each([
    [0, "vient d’arriver"],
    [1, "attend depuis 1 min"],
    [12, "attend depuis 12 min"],
    [59, "attend depuis 59 min"],
    [60, "attend depuis 1 heure"],
    [61, "attend depuis 1 h 01"],
    [120, "attend depuis 2 heures"],
    [125, "attend depuis 2 h 05"],
  ])("%i min → «%s»", (minutes, expected) => {
    expect(formatWaitingTime(minutes)).toBe(expected);
  });
});

describe("waitingMinutes", () => {
  const arrivedAt = new Date("2026-10-09T09:00:00.000Z");

  it("counts whole minutes since the arrival", () => {
    expect(
      waitingMinutes(arrivedAt, new Date("2026-10-09T09:12:59.999Z")),
    ).toBe(12);
  });

  it("never goes negative when the browser clock lags the server's", () => {
    expect(
      waitingMinutes(arrivedAt, new Date("2026-10-09T08:59:30.000Z")),
    ).toBe(0);
  });
});

describe("waitingTone", () => {
  it("keeps the thresholds in order", () => {
    expect(WAITING_WARNING_MINUTES).toBeLessThan(WAITING_DANGER_MINUTES);
  });

  it.each([
    [0, "normal"],
    [WAITING_WARNING_MINUTES - 1, "normal"],
    [WAITING_WARNING_MINUTES, "warning"],
    [WAITING_DANGER_MINUTES - 1, "warning"],
    [WAITING_DANGER_MINUTES, "danger"],
    [180, "danger"],
  ] as const)("%i min → %s", (minutes, tone) => {
    expect(waitingTone(minutes)).toBe(tone);
  });
});

describe("arrivedAtFor", () => {
  const now = new Date("2026-10-09T09:00:00.000Z");

  it("sets it when the patient arrives", () => {
    expect(arrivedAtFor(AppointmentStatus.Arrived, now)).toBe(now);
  });

  it.each([AppointmentStatus.Planned, AppointmentStatus.Confirmed])(
    "clears it on a correction back to %s",
    (to) => {
      expect(arrivedAtFor(to, now)).toBeNull();
    },
  );

  it.each([
    AppointmentStatus.Completed,
    AppointmentStatus.Canceled,
    AppointmentStatus.NoShow,
  ])("keeps it (history) on → %s", (to) => {
    expect(arrivedAtFor(to, now)).toBeUndefined();
  });

  it("every legal move leaves arrivedAt consistent with the new status", () => {
    // The database CHECK: arrived ⇒ set; planned / confirmed ⇒ null.
    for (const [from, targets] of Object.entries(
      APPOINTMENT_STATUS_TRANSITIONS,
    )) {
      const before = from === AppointmentStatus.Arrived ? new Date(0) : null;
      for (const to of targets) {
        const written = arrivedAtFor(to, now);
        const after = written === undefined ? before : written;
        if (to === AppointmentStatus.Arrived) expect(after).not.toBeNull();
        if (
          to === AppointmentStatus.Planned ||
          to === AppointmentStatus.Confirmed
        ) {
          expect(after).toBeNull();
        }
      }
    }
  });
});
