import { describe, expect, it } from "vitest";

import {
  absenceRate,
  cancellationRate,
  formatCompactDH,
  formatPercent,
  pointsDelta,
  relativeDelta,
  shareOf,
} from "./rules";

const NBSP = " ";

describe("relativeDelta", () => {
  it("rises and falls in whole per cent, French signs", () => {
    expect(relativeDelta(112, 100)).toEqual({
      kind: "up",
      label: `+12${NBSP}%`,
    });
    expect(relativeDelta(92, 100)).toEqual({
      kind: "down",
      label: `−8${NBSP}%`,
    });
  });

  it("one decimal under 10 %", () => {
    expect(relativeDelta(1023, 1000).label).toBe(`+2,3${NBSP}%`);
  });

  it("equal and tiny changes read «stable»", () => {
    expect(relativeDelta(100, 100)).toEqual({
      kind: "stable",
      label: "stable",
    });
    expect(relativeDelta(1004, 1000).kind).toBe("stable");
    expect(relativeDelta(996, 1000).kind).toBe("stable");
  });

  it("a previous 0 is «Nouveau» — never Infinity or NaN", () => {
    expect(relativeDelta(500, 0)).toEqual({ kind: "new", label: "Nouveau" });
    expect(relativeDelta(-500, 0).kind).toBe("new");
    expect(relativeDelta(0, 0)).toEqual({ kind: "stable", label: "stable" });
  });

  it("a negative previous value divides by its magnitude", () => {
    // A loss of 1 000 halved to 500 is an improvement.
    expect(relativeDelta(-500, -1000)).toEqual({
      kind: "up",
      label: `+50${NBSP}%`,
    });
    expect(relativeDelta(-1500, -1000).kind).toBe("down");
  });

  it("never prints NaN or Infinity", () => {
    for (const [current, previous] of [
      [0, 0],
      [1, 0],
      [Number.NaN, 1],
      [1, Number.POSITIVE_INFINITY],
    ]) {
      expect(relativeDelta(current, previous).label).not.toMatch(
        /NaN|Infinity/,
      );
    }
  });
});

describe("pointsDelta", () => {
  it("compares rates in points", () => {
    expect(pointsDelta(0.1, 0.07)).toEqual({
      kind: "up",
      label: `+3${NBSP}pt`,
    });
    expect(pointsDelta(0.07, 0.1)?.label).toBe(`−3${NBSP}pt`);
  });

  it("is stable under half a point", () => {
    expect(pointsDelta(0.071, 0.07)?.kind).toBe("stable");
  });

  it("has no delta when a side has no rate", () => {
    expect(pointsDelta(null, 0.1)).toBeNull();
    expect(pointsDelta(0.1, null)).toBeNull();
  });
});

describe("rates", () => {
  it("absence = no_show / (completed + no_show)", () => {
    expect(absenceRate({ completed: 93, noShow: 7 })).toBeCloseTo(0.07);
  });

  it("absence has no rate without a known outcome", () => {
    expect(absenceRate({ completed: 0, noShow: 0 })).toBeNull();
  });

  it("cancellation = canceled / total, null without appointments", () => {
    expect(cancellationRate({ canceled: 8, total: 100 })).toBeCloseTo(0.08);
    expect(cancellationRate({ canceled: 0, total: 0 })).toBeNull();
  });
});

describe("formatPercent", () => {
  it("one decimal, comma, non-breaking space", () => {
    expect(formatPercent(0.0734)).toBe(`7,3${NBSP}%`);
    expect(formatPercent(0.5)).toBe(`50${NBSP}%`);
    expect(formatPercent(0)).toBe(`0${NBSP}%`);
  });

  it("«—» without a rate", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatCompactDH", () => {
  it("units, thousands and millions", () => {
    expect(formatCompactDH(0)).toBe(`0${NBSP}DH`);
    expect(formatCompactDH(85_000)).toBe(`850${NBSP}DH`);
    expect(formatCompactDH(120_000)).toBe(`1,2${NBSP}k${NBSP}DH`);
    expect(formatCompactDH(1_200_000)).toBe(`12${NBSP}k${NBSP}DH`);
    expect(formatCompactDH(95_000_000)).toBe(`950${NBSP}k${NBSP}DH`);
    expect(formatCompactDH(120_000_000)).toBe(`1,2${NBSP}M${NBSP}DH`);
  });

  it("promotes 999,95 k to 1 M instead of «1000 k»", () => {
    expect(formatCompactDH(99_995_000)).toBe(`1${NBSP}M${NBSP}DH`);
  });

  it("negative amounts keep the French minus", () => {
    expect(formatCompactDH(-1_200_000)).toBe(`−12${NBSP}k${NBSP}DH`);
  });

  it("the number is never wider than 4 characters", () => {
    for (let cents = 1; cents < 10_000_000_000; cents *= 3) {
      const number = formatCompactDH(cents).split(NBSP)[0];
      expect(number.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("shareOf", () => {
  it("is 0 for an empty total", () => {
    expect(shareOf(5, 0)).toBe(0);
    expect(shareOf(1, 4)).toBe(0.25);
  });
});
