import { describe, expect, it } from "vitest";

import { AppointmentStatus } from "@/modules/appointments/types";
import {
  durationLabel,
  greetingLine,
  remainingHint,
  todaySummary,
} from "./constants";
import { arrivalPath, greetingForHour, netProfitCents } from "./rules";
import { Greeting } from "./types";

describe("greetingForHour", () => {
  it("says Bonjour before noon", () => {
    for (const hour of [0, 6, 11]) {
      expect(greetingForHour(hour)).toBe(Greeting.Morning);
    }
  });

  it("says Bon après-midi from 12:00 to 17:59", () => {
    for (const hour of [12, 15, 17]) {
      expect(greetingForHour(hour)).toBe(Greeting.Afternoon);
    }
  });

  it("says Bonsoir from 18:00", () => {
    for (const hour of [18, 21, 23]) {
      expect(greetingForHour(hour)).toBe(Greeting.Evening);
    }
  });
});

describe("greetingLine", () => {
  it("greets by name, in French", () => {
    expect(greetingLine(Greeting.Morning, "Salma Berrada")).toBe(
      "Bonjour, Salma Berrada",
    );
    expect(greetingLine(Greeting.Afternoon, "Salma")).toBe(
      "Bon après-midi, Salma",
    );
    expect(greetingLine(Greeting.Evening, "Salma")).toBe("Bonsoir, Salma");
  });

  it("never prints a dangling comma", () => {
    expect(greetingLine(Greeting.Morning, "  ")).toBe("Bonjour");
  });
});

describe("todaySummary", () => {
  it("says so when there is nothing today", () => {
    expect(todaySummary({ total: 0, remaining: 0, completed: 0 })).toBe(
      "Aucun rendez-vous aujourd’hui.",
    );
  });

  it("counts one remaining appointment", () => {
    expect(todaySummary({ total: 5, remaining: 1, completed: 3 })).toBe(
      "Il vous reste 1 rendez-vous sur 5 aujourd’hui.",
    );
  });

  it("counts N remaining appointments", () => {
    expect(todaySummary({ total: 8, remaining: 6, completed: 1 })).toBe(
      "Il vous reste 6 rendez-vous sur 8 aujourd’hui.",
    );
  });

  it("closes the day when none is left, with French plurals", () => {
    expect(todaySummary({ total: 5, remaining: 0, completed: 5 })).toBe(
      "La journée est terminée : 5 rendez-vous honorés.",
    );
    expect(todaySummary({ total: 2, remaining: 0, completed: 1 })).toBe(
      "La journée est terminée : 1 rendez-vous honoré.",
    );
    expect(todaySummary({ total: 2, remaining: 0, completed: 0 })).toBe(
      "La journée est terminée : aucun rendez-vous honoré.",
    );
  });

  it("never prints more remaining than the day holds", () => {
    expect(todaySummary({ total: 2, remaining: 3, completed: 0 })).toBe(
      "Il vous reste 2 rendez-vous sur 2 aujourd’hui.",
    );
  });
});

describe("remainingHint and durationLabel", () => {
  it("agrees in number", () => {
    expect(remainingHint(0)).toBe("aucun restant");
    expect(remainingHint(1)).toBe("dont 1 restant");
    expect(remainingHint(4)).toBe("dont 4 restants");
  });

  it("reads minutes and hours", () => {
    expect(durationLabel(30)).toBe("30 min");
    expect(durationLabel(60)).toBe("1 h");
    expect(durationLabel(90)).toBe("1 h 30");
  });
});

describe("arrivalPath", () => {
  it("is one move from confirmed", () => {
    expect(arrivalPath(AppointmentStatus.Confirmed)).toEqual([
      AppointmentStatus.Arrived,
    ]);
  });

  it("goes through confirmed from planned — the table has no direct edge", () => {
    expect(arrivalPath(AppointmentStatus.Planned)).toEqual([
      AppointmentStatus.Confirmed,
      AppointmentStatus.Arrived,
    ]);
  });

  it("offers nothing once arrived or terminal", () => {
    for (const status of [
      AppointmentStatus.Arrived,
      AppointmentStatus.Completed,
      AppointmentStatus.Canceled,
      AppointmentStatus.NoShow,
    ]) {
      expect(arrivalPath(status)).toEqual([]);
    }
  });
});

describe("netProfitCents (prompts/26, decision 5)", () => {
  it("is revenue minus charges when the period has a charge", () => {
    expect(
      netProfitCents({ revenueCents: 5_000_000, chargesCents: 1_200_000, expenseCount: 4 }),
    ).toBe(3_800_000);
  });

  it("is negative on a loss — never clamped", () => {
    expect(
      netProfitCents({ revenueCents: 100_000, chargesCents: 800_000, expenseCount: 1 }),
    ).toBe(-700_000);
  });

  it("is null when no charge is recorded, never the revenue itself", () => {
    expect(
      netProfitCents({ revenueCents: 5_000_000, chargesCents: 0, expenseCount: 0 }),
    ).toBeNull();
  });
});
