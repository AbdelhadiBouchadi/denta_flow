import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addCalendarDays, clinicInstant } from "@/lib/time";
import {
  computeSchedule,
  decideAtSendTime,
  isInsideWindow,
  nextWindowStart,
  type SendWindow,
} from "./schedule";
import { WhatsappEvent, WhatsappSkipReason } from "./types";

const WINDOW: SendWindow = {
  windowStart: "09:00",
  windowEnd: "19:00",
  minLeadMinutes: 120,
};

const at = clinicInstant;
const H = 60;
const reminder24h = { offsetMinutes: 24 * H };

const reminder = (startsAt: Date, now: Date, offsetMinutes = 24 * H) =>
  computeSchedule({
    event: WhatsappEvent.Reminder,
    startsAt,
    now,
    rule: { offsetMinutes },
    settings: WINDOW,
  });

const after = (
  event: WhatsappEvent,
  startsAt: Date,
  now: Date,
  delay = 0,
) =>
  computeSchedule({ event, startsAt, now, rule: { offsetMinutes: delay }, settings: WINDOW });

const tooLate = { skip: WhatsappSkipReason.TooLate };

/** The first 2026 day the clinic runs on UTC+0 (Ramadan). */
const firstUtcDay = () => {
  let day = "2026-01-01";
  while (at(day, "12:00").getUTCHours() !== 12) day = addCalendarDays(day, 1);
  return day;
};

const suite = () => {
  describe("reminder", () => {
    it("goes 24 h before, inside the window", () => {
      expect(reminder(at("2026-10-14", "14:30"), at("2026-10-10", "10:00"))).toEqual({
        scheduledFor: at("2026-10-13", "14:30"),
      });
    });

    it("moves an 08:30 target up to 09:00 the same day", () => {
      expect(reminder(at("2026-10-14", "08:30"), at("2026-10-10", "10:00"))).toEqual({
        scheduledFor: at("2026-10-13", "09:00"),
      });
    });

    it("moves a 19:30 target back to 19:00 the same day", () => {
      expect(reminder(at("2026-10-14", "19:30"), at("2026-10-10", "10:00"))).toEqual({
        scheduledFor: at("2026-10-13", "19:00"),
      });
    });

    it("handles a 23:30 and a 00:30 appointment on their own clinic days", () => {
      expect(reminder(at("2026-10-14", "23:30"), at("2026-10-10", "10:00"))).toEqual({
        scheduledFor: at("2026-10-13", "19:00"),
      });
      // 00:30 on the 15th → target 00:30 on the 14th → 09:00 on the 14th.
      expect(reminder(at("2026-10-15", "00:30"), at("2026-10-10", "10:00"))).toEqual({
        scheduledFor: at("2026-10-14", "09:00"),
      });
    });

    it("sends a Monday-morning reminder on Sunday, inside the window", () => {
      // 2026-10-19 is a Monday.
      expect(reminder(at("2026-10-19", "09:00"), at("2026-10-15", "10:00"))).toEqual({
        scheduledFor: at("2026-10-18", "09:00"),
      });
    });

    it("is too late for an appointment booked 90 minutes ahead", () => {
      expect(reminder(at("2026-10-14", "11:30"), at("2026-10-14", "10:00"))).toEqual(
        tooLate,
      );
    });

    it("goes as soon as possible when booked late but before the lead", () => {
      const now = at("2026-10-14", "10:00");
      expect(reminder(at("2026-10-14", "18:00"), now)).toEqual({ scheduledFor: now });
    });

    it("waits for the next window when booked late outside it", () => {
      expect(reminder(at("2026-10-15", "15:00"), at("2026-10-14", "21:00"))).toEqual({
        scheduledFor: at("2026-10-15", "09:00"),
      });
    });

    it("is too late when the next window opens after the lead", () => {
      expect(reminder(at("2026-10-15", "10:00"), at("2026-10-14", "22:00"))).toEqual(
        tooLate,
      );
    });

    it("does not clamp back into the past", () => {
      // Target 19:30 today, clamped to 19:00 — already gone at 19:20.
      expect(reminder(at("2026-10-15", "19:30"), at("2026-10-14", "19:20"))).toEqual({
        scheduledFor: at("2026-10-15", "09:00"),
      });
    });

    it("refuses a clamped moment later than the lead", () => {
      // 1 h rule on a 09:30 appointment: target 08:30 → 09:00 > 07:30.
      expect(
        reminder(at("2026-10-14", "09:30"), at("2026-10-10", "10:00"), 60),
      ).toEqual(tooLate);
    });

    it("draws the window on the clinic clock across a clock change", () => {
      const change = firstUtcDay();
      const before = addCalendarDays(change, -1);
      // The window opens at 09:00 clinic time on both days, a different UTC hour.
      expect(at(change, "09:00").getUTCHours()).toBe(9);
      expect(at(before, "09:00").getUTCHours()).toBe(8);
      // 24 h is a duration: the day before runs on UTC+1, so 08:30 (UTC+0)
      // minus 24 h reads 09:30 on that day's clinic clock — inside the window.
      const result = reminder(at(change, "08:30"), at(addCalendarDays(change, -5), "10:00"));
      expect(result).toEqual({ scheduledFor: at(before, "09:30") });
      // And 07:30 on the change day → 08:30 the day before → moved to 09:00.
      expect(
        reminder(at(change, "07:30"), at(addCalendarDays(change, -5), "10:00"), 24 * H),
      ).toEqual({ scheduledFor: at(before, "09:00") });
    });
  });

  describe("confirmation, reschedule, cancellation", () => {
    it("goes immediately inside the window", () => {
      const now = at("2026-10-14", "14:00");
      expect(after(WhatsappEvent.Confirmation, at("2026-10-20", "10:00"), now)).toEqual({
        scheduledFor: now,
      });
    });

    it("applies the delay", () => {
      expect(
        after(WhatsappEvent.Confirmation, at("2026-10-20", "10:00"), at("2026-10-14", "14:00"), 2 * H),
      ).toEqual({ scheduledFor: at("2026-10-14", "16:00") });
    });

    it("waits for the next window when that is still before the appointment", () => {
      expect(
        after(WhatsappEvent.Cancellation, at("2026-10-15", "15:00"), at("2026-10-14", "22:00")),
      ).toEqual({ scheduledFor: at("2026-10-15", "09:00") });
    });

    it("sends a 22:00 cancellation of an 08:30 next-morning appointment at once", () => {
      const now = at("2026-10-14", "22:00");
      expect(after(WhatsappEvent.Cancellation, at("2026-10-15", "08:30"), now)).toEqual({
        scheduledFor: now,
      });
    });

    it("ignores the minimum lead", () => {
      const now = at("2026-10-14", "10:00");
      expect(after(WhatsappEvent.Reschedule, at("2026-10-14", "10:45"), now)).toEqual({
        scheduledFor: now,
      });
    });

    it("is too late only once the appointment has started", () => {
      expect(
        after(WhatsappEvent.Reschedule, at("2026-10-14", "09:30"), at("2026-10-14", "10:00")),
      ).toEqual(tooLate);
    });

    it("uses eventAt when given", () => {
      expect(
        computeSchedule({
          event: WhatsappEvent.Confirmation,
          startsAt: at("2026-10-20", "10:00"),
          now: at("2026-10-14", "12:00"),
          eventAt: at("2026-10-14", "11:00"),
          rule: { offsetMinutes: 2 * H },
          settings: WINDOW,
        }),
      ).toEqual({ scheduledFor: at("2026-10-14", "13:00") });
    });
  });

  describe("window helpers", () => {
    it("includes both boundaries", () => {
      expect(isInsideWindow(at("2026-10-14", "09:00"), WINDOW)).toBe(true);
      expect(isInsideWindow(at("2026-10-14", "19:00"), WINDOW)).toBe(true);
      expect(isInsideWindow(at("2026-10-14", "19:01"), WINDOW)).toBe(false);
    });

    it("finds the next opening", () => {
      expect(nextWindowStart(at("2026-10-14", "07:00"), WINDOW)).toEqual(at("2026-10-14", "09:00"));
      expect(nextWindowStart(at("2026-10-14", "23:30"), WINDOW)).toEqual(at("2026-10-15", "09:00"));
    });
  });

  describe("decideAtSendTime", () => {
    it("sends a due reminder inside the window", () => {
      expect(
        decideAtSendTime({
          event: WhatsappEvent.Reminder,
          startsAt: at("2026-10-15", "15:00"),
          now: at("2026-10-14", "15:00"),
          settings: WINDOW,
        }),
      ).toEqual({ send: true });
    });

    it("reschedules a reminder found outside the window", () => {
      expect(
        decideAtSendTime({
          event: WhatsappEvent.Reminder,
          startsAt: at("2026-10-15", "15:00"),
          now: at("2026-10-14", "20:00"),
          settings: WINDOW,
        }),
      ).toEqual({ reschedule: at("2026-10-15", "09:00") });
    });

    it("skips a reminder past the lead and an appointment already started", () => {
      expect(
        decideAtSendTime({
          event: WhatsappEvent.Reminder,
          startsAt: at("2026-10-14", "11:00"),
          now: at("2026-10-14", "10:00"),
          settings: WINDOW,
        }),
      ).toEqual(tooLate);
      expect(
        decideAtSendTime({
          event: WhatsappEvent.Cancellation,
          startsAt: at("2026-10-14", "09:00"),
          now: at("2026-10-14", "10:00"),
          settings: WINDOW,
        }),
      ).toEqual(tooLate);
    });

    it("sends a late-night cancellation of an early appointment now", () => {
      expect(
        decideAtSendTime({
          event: WhatsappEvent.Cancellation,
          startsAt: at("2026-10-15", "08:30"),
          now: at("2026-10-14", "22:00"),
          settings: WINDOW,
        }),
      ).toEqual({ send: true });
    });
  });

  it("keeps the 24 h rule's offset as given", () => {
    expect(reminder24h.offsetMinutes).toBe(1440);
  });
};

describe("computeSchedule (TZ=UTC)", suite);

describe("computeSchedule (TZ=Asia/Tokyo)", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterAll(() => {
    process.env.TZ = original;
  });
  suite();
});
