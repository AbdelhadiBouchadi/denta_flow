import { tzOffset } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { CLINIC_TIMEZONE } from "@/constants";
import { formatExceptionPeriod } from "./constants";
import {
  exceptionToInstants,
  instantsToExceptionPeriod,
  type ExceptionPeriod,
} from "./exceptions";

/**
 * TZ=UTC (vitest.config.ts), so a conversion that leaked the process timezone
 * would land on UTC midnight and fail here. Two regimes on purpose:
 * 2026-03-05 is inside Ramadan 2026 (UTC+0), 2026-04-15 is not (UTC+1).
 */

const day = (date: string): ExceptionPeriod => ({
  startDate: date,
  endDate: date,
  allDay: true,
  startTime: "",
  endTime: "",
});

describe("exceptionToInstants", () => {
  it("resolves a Ramadan day and an April day to different UTC offsets", () => {
    const ramadan = exceptionToInstants(day("2026-03-05"));
    const april = exceptionToInstants(day("2026-04-15"));

    expect(ramadan.startsAt.toISOString()).toBe("2026-03-05T00:00:00.000Z");
    expect(april.startsAt.toISOString()).toBe("2026-04-14T23:00:00.000Z");

    expect(tzOffset(CLINIC_TIMEZONE, ramadan.startsAt)).toBe(0);
    expect(tzOffset(CLINIC_TIMEZONE, april.startsAt)).toBe(60);
  });

  it("starts a one-day closure at clinic midnight, not UTC midnight", () => {
    const { startsAt, endsAt } = exceptionToInstants(day("2026-06-15"));

    expect(startsAt.toISOString()).toBe("2026-06-14T23:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-06-15T23:00:00.000Z");
  });

  it("runs a multi-day closure to the midnight after its last day", () => {
    const { startsAt, endsAt } = exceptionToInstants({
      ...day("2026-06-15"),
      endDate: "2026-06-19",
    });

    expect(endsAt.getTime() - startsAt.getTime()).toBe(5 * 24 * 3600 * 1000);
  });

  it("places a partial closure on the clinic wall clock", () => {
    const { startsAt, endsAt } = exceptionToInstants({
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      allDay: false,
      startTime: "14:00",
      endTime: "18:30",
    });

    expect(startsAt.toISOString()).toBe("2026-06-15T13:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-06-15T17:30:00.000Z");
  });
});

describe("instantsToExceptionPeriod", () => {
  const periods: ExceptionPeriod[] = [
    day("2026-03-05"),
    { ...day("2026-06-15"), endDate: "2026-06-30" },
    {
      startDate: "2026-04-15",
      endDate: "2026-04-16",
      allDay: false,
      startTime: "08:30",
      endTime: "12:00",
    },
  ];

  it("round-trips every period through its instants", () => {
    for (const period of periods) {
      expect(instantsToExceptionPeriod(exceptionToInstants(period))).toEqual(
        period,
      );
    }
  });

  it("reads the seed's midnight-to-midnight rows as whole days", () => {
    expect(
      instantsToExceptionPeriod({
        startsAt: new Date("2026-06-14T23:00:00Z"),
        endsAt: new Date("2026-06-15T23:00:00Z"),
      }),
    ).toEqual(day("2026-06-15"));
  });
});

describe("formatExceptionPeriod", () => {
  it("reads a single day, a span and a partial day in French", () => {
    expect(formatExceptionPeriod(day("2026-10-12"))).toBe("Le 12/10/2026");
    expect(
      formatExceptionPeriod({ ...day("2026-10-12"), endDate: "2026-10-14" }),
    ).toBe("Du 12/10/2026 au 14/10/2026");
    expect(
      formatExceptionPeriod({
        ...day("2026-10-12"),
        allDay: false,
        startTime: "14:00",
        endTime: "18:00",
      }),
    ).toBe("Le 12/10/2026, de 14:00 à 18:00");
  });
});
