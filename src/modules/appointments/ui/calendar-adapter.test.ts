import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COLOR_PALETTE } from "@/components/shared/color-palette";
import { clinicInstant } from "@/lib/time";
import { type AppointmentListItem, CalendarView } from "../types";
import {
  fromCalendarAnchor,
  fromCalendarDate,
  fromCalendarMove,
  fromCalendarView,
  legendDotClass,
  toCalendarAnchor,
  toCalendarDate,
  toCalendarEvent,
  toCalendarView,
  toDialogIntent,
} from "./calendar-adapter";

/**
 * The calendar lays events out on the BROWSER's wall clock, so the adapter
 * must give the same clinic-local fields whatever zone the browser is in.
 * Node re-reads `process.env.TZ` on assignment, so the same assertions run
 * once per viewer zone. Tokyo is UTC+9 with no DST: a leaked browser offset
 * moves a 09:00 appointment to 18:00 or onto the next day.
 */
const VIEWER_ZONES = ["UTC", "Asia/Tokyo"] as const;

/** Clinic wall-clock instants, inside and outside Ramadan 2026. */
const INSTANTS = [
  // Ramadan: Casablanca is UTC+0.
  { label: "Ramadan, 09:00", date: "2026-03-12", time: "09:00" },
  // The day Casablanca goes back to UTC+1.
  { label: "end of Ramadan, 09:00", date: "2026-03-22", time: "09:00" },
  // Outside Ramadan: UTC+1.
  { label: "June, 17:45", date: "2026-06-15", time: "17:45" },
  // Late evening: the UTC date differs from the clinic date in UTC+1.
  { label: "late evening", date: "2026-06-15", time: "23:30" },
];

describe.each(VIEWER_ZONES)("viewer in %s", (zone) => {
  const previousZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = previousZone;
  });

  it.each(INSTANTS)(
    "shows $label at the clinic's wall clock and round-trips",
    ({ date, time }) => {
      const instant = clinicInstant(date, time);
      const local = toCalendarDate(instant);
      const [hours, minutes] = time.split(":").map(Number);

      expect(fromCalendarAnchor(local)).toBe(date);
      expect(local.getHours()).toBe(hours);
      expect(local.getMinutes()).toBe(minutes);
      expect(fromCalendarDate(local).getTime()).toBe(instant.getTime());
    },
  );

  it("turns a drop back into the clinic slot it landed on", () => {
    const dropped = toCalendarDate(clinicInstant("2026-03-12", "10:30"));
    expect(
      fromCalendarMove({ id: "a1", title: "", start: dropped, end: dropped }),
    ).toEqual({ id: "a1", date: "2026-03-12", time: "10:30" });
  });

  it("keeps the URL's clinic day as the calendar's anchor day", () => {
    for (const day of ["2026-03-12", "2026-12-31", "2027-01-01"]) {
      expect(fromCalendarAnchor(toCalendarAnchor(day))).toBe(day);
    }
  });
});

describe("toCalendarEvent", () => {
  const item = {
    id: "a1",
    startsAt: clinicInstant("2026-03-12", "09:00"),
    endsAt: clinicInstant("2026-03-12", "09:45"),
    reason: "Contrôle",
    patient: { firstName: "Karim", lastName: "Benali" },
    type: { color: "#DC2626" },
  } as unknown as AppointmentListItem;

  it("titles the block with the patient's name and keeps the slot", () => {
    const event = toCalendarEvent(item);
    expect(event).toMatchObject({
      id: "a1",
      title: "BENALI Karim",
      description: "Contrôle",
      color: "red",
    });
    expect(fromCalendarDate(event.start)).toEqual(item.startsAt);
    expect(fromCalendarDate(event.end)).toEqual(item.endsAt);
  });

  it("falls back to one colour without a type", () => {
    expect(toCalendarEvent({ ...item, type: null }).color).toBe("orange");
  });
});

/** The block colour a type colour produces. */
const colorOf = (hex: string) =>
  toCalendarEvent({
    id: "a1",
    startsAt: new Date(0),
    endsAt: new Date(0),
    reason: null,
    patient: { firstName: "A", lastName: "B" },
    type: { color: hex },
  } as unknown as AppointmentListItem).color;

describe("colours", () => {
  it.each(COLOR_PALETTE)("maps the $label swatch, in any case", ({ value }) => {
    expect(legendDotClass(value)).toBe(legendDotClass(value.toLowerCase()));
    expect(legendDotClass(value)).not.toBe(legendDotClass(null));
  });

  it("gives every swatch its own colour, block and legend alike", () => {
    const colors = COLOR_PALETTE.map(({ value }) => colorOf(value));
    expect(new Set(colors).size).toBe(COLOR_PALETTE.length);
    const dots = COLOR_PALETTE.map(({ value }) => legendDotClass(value));
    expect(new Set(dots).size).toBe(COLOR_PALETTE.length);
  });

  it("gives the legend the block's colour", () => {
    expect(colorOf("#2563EB")).toBe("blue");
    expect(legendDotClass("#2563EB")).toBe("bg-blue-400");
  });

  it("falls back for a colour saved before the palette existed", () => {
    expect(legendDotClass("#0891B2")).toBe(legendDotClass(null));
  });
});

describe("views", () => {
  it.each(Object.values(CalendarView))("round-trips %s", (view) => {
    expect(fromCalendarView(toCalendarView(view))).toBe(view);
  });
});

describe("toDialogIntent", () => {
  const start = new Date(2026, 2, 12, 10, 37);

  it("is closed when the calendar says so", () => {
    expect(toDialogIntent({ event: null, isOpen: false })).toEqual({
      kind: "closed",
    });
  });

  it("opens a blank booking from the «Nouveau» button", () => {
    expect(toDialogIntent({ event: null, isOpen: true })).toEqual({
      kind: "new",
    });
  });

  it("pre-fills an empty slot, floored to the agenda step", () => {
    expect(
      toDialogIntent({
        event: { id: "", title: "", start, end: start },
        isOpen: true,
      }),
    ).toEqual({ kind: "slot", date: "2026-03-12", time: "10:30" });
  });

  it("edits a clicked appointment", () => {
    expect(
      toDialogIntent({
        event: { id: "a1", title: "", start, end: start },
        isOpen: true,
      }),
    ).toEqual({ kind: "edit", id: "a1" });
  });
});
