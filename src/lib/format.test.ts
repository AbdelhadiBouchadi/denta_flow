import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatDH,
  formatPhone,
  formatTime,
  formatTooth,
  parseDH,
} from "@/lib/format";

/** Strips the suffix `formatDH` adds, so the result can go back through `parseDH`. */
const withoutSuffix = (formatted: string) => formatted.replace(" DH", "");

/**
 * A seeded LCG rather than Math.random: a property test that fails must fail
 * again on the next run, or it cannot be debugged.
 */
const pseudoRandom = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
};

describe("formatDH", () => {
  it("renders centimes as the specified amount", () => {
    expect(formatDH(125000)).toBe("1 250,00 DH");
  });

  it("always shows two decimals and never another currency mark", () => {
    expect(formatDH(0)).toBe("0,00 DH");
    expect(formatDH(5)).toBe("0,05 DH");
    expect(formatDH(50)).toBe("0,50 DH");
    expect(formatDH(100)).toBe("1,00 DH");
  });

  it("groups thousands with a plain space", () => {
    expect(formatDH(100000000)).toBe("1 000 000,00 DH");
    // The separator is U+0020, not a no-break space: the assertions above
    // would pass on either, this one pins it.
    expect(formatDH(125000).charCodeAt(1)).toBe(32);
  });

  it("renders negative amounts — a credit balance («Avance») is never clamped", () => {
    expect(formatDH(-125000)).toBe("-1 250,00 DH");
    expect(formatDH(-1)).toBe("-0,01 DH");
  });
});

describe("parseDH", () => {
  it("parses the format it produces", () => {
    expect(parseDH("1 250,00")).toBe(125000);
  });

  it("parses a raw keyboard entry with a decimal point", () => {
    expect(parseDH("1250.5")).toBe(125050);
    expect(parseDH("1250")).toBe(125000);
  });

  it("parses pasted amounts carrying no-break spaces", () => {
    expect(parseDH(`1${String.fromCharCode(0x00a0)}250,00`)).toBe(125000);
    expect(parseDH(`1${String.fromCharCode(0x202f)}250,00`)).toBe(125000);
  });

  it("parses negative amounts", () => {
    expect(parseDH("-1 250,00")).toBe(-125000);
  });

  it("rounds to the centime instead of carrying a float error", () => {
    expect(parseDH("1250,03")).toBe(125003);
    expect(parseDH("0,1")).toBe(10);
    expect(parseDH("19,99")).toBe(1999);
  });

  it("returns NaN for input that is not an amount", () => {
    expect(parseDH("abc")).toBeNaN();
  });
});

describe("formatDH ↔ parseDH round trip", () => {
  it("survives a round trip on known edge values", () => {
    const values = [
      0, 1, 5, 99, 100, 999, 1000, 99999, 100000000, -1, -99, -125000,
    ];

    for (const cents of values) {
      expect(parseDH(withoutSuffix(formatDH(cents)))).toBe(cents);
    }
  });

  it("survives a round trip on random centime values, positive and negative", () => {
    const next = pseudoRandom(20260920);

    for (let i = 0; i < 1000; i++) {
      // Up to 1 000 000,00 DH — far above any real invoice, far below the
      // float range where centimes stop being representable.
      const magnitude = Math.floor(next() * 100_000_001);
      const cents = next() < 0.5 ? -magnitude : magnitude;

      expect(parseDH(withoutSuffix(formatDH(cents)))).toBe(cents);
    }
  });
});

describe("date and time formatting", () => {
  // Fixed instants, so these assertions hold whatever the machine's timezone is.
  const summerInstant = "2026-06-15T12:00:00Z"; // Morocco at UTC+1
  const ramadanInstant = "2026-03-05T23:30:00Z"; // Morocco at UTC+0

  it("renders the date on the clinic's wall clock", () => {
    expect(formatDate(summerInstant)).toBe("15/06/2026");
  });

  it("renders the time on the clinic's wall clock", () => {
    expect(formatTime(summerInstant)).toBe("13 h 00");
  });

  it("renders date and time joined by « à »", () => {
    expect(formatDateTime(summerInstant)).toBe("15/06/2026 à 13 h 00");
  });

  it("does not shift the clinic day by an hour during Ramadan", () => {
    // At UTC+1 this instant would already be 2026-03-06 00:30 in the clinic.
    expect(formatDateTime(ramadanInstant)).toBe("05/03/2026 à 23 h 30");
  });

  it("accepts a Date as readily as an ISO string", () => {
    expect(formatDate(new Date(summerInstant))).toBe("15/06/2026");
  });
});

describe("formatPhone", () => {
  it("spaces a Moroccan mobile number", () => {
    expect(formatPhone("+212661234567")).toBe("+212 6 61 23 45 67");
  });

  it("leaves a number it does not recognise untouched", () => {
    expect(formatPhone("0661234567")).toBe("0661234567");
  });
});

describe("formatTooth", () => {
  it("labels an FDI number", () => {
    expect(formatTooth("26")).toBe("Dent 26");
  });
});
