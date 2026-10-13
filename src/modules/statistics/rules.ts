import { CURRENCY_SUFFIX } from "@/constants";
import { STATISTICS_DELTA_LABELS as D } from "./constants";

/**
 * The page's definitions, as pure functions — the procedures, the view and
 * Vitest all read them. No React, no `db`.
 */

// ── Rates ───────────────────────────────────────────────────────────────────

/**
 * «Taux d'absence» = no_show / (completed + no_show): only appointments
 * whose outcome is known count — a future `planned` / `confirmed` /
 * `arrived` has none yet, and a `canceled` one never happened. A ratio in
 * [0, 1], or null when nothing is known (shown «—», never 0 %).
 */
export const absenceRate = ({
  completed,
  noShow,
}: {
  completed: number;
  noShow: number;
}): number | null => {
  const known = completed + noShow;
  return known > 0 ? noShow / known : null;
};

/** «Taux d'annulation» = canceled / every appointment in the period, or null. */
export const cancellationRate = ({
  canceled,
  total,
}: {
  canceled: number;
  total: number;
}): number | null => (total > 0 ? canceled / total : null);

// ── Delta vs the previous period ────────────────────────────────────────────

/** |Δ| under this many per cent (or points, for a rate) reads «stable». */
export const STABLE_THRESHOLD = 0.5;

export type DeltaKind = "up" | "down" | "stable" | "new";

export interface Delta {
  kind: DeltaKind;
  /** «+12 %», «−8 %», «stable», «Nouveau» — already French. */
  label: string;
}

const MINUS = "−"; // U+2212, French typography
const NBSP = " ";

/** 12.345 → «12», 2.345 → «2,3»: one decimal under 10, whole above. */
const formatMagnitude = (value: number) => {
  const abs = Math.abs(value);
  const rounded = abs < 10 ? Math.round(abs * 10) / 10 : Math.round(abs);
  return String(rounded).replace(".", ",");
};

const signed = (value: number, unit: string): Delta => ({
  kind: value > 0 ? "up" : "down",
  label: `${value > 0 ? "+" : MINUS}${formatMagnitude(value)}${NBSP}${unit}`,
});

/**
 * The change from `previous` to `current`, relative. Never `Infinity`,
 * `NaN` or a division by zero: a previous value of 0 reads «Nouveau» (or
 * «stable» when both are 0). A negative previous value (a loss) divides by
 * its absolute value, so going from −1 000 to −500 reads as an improvement.
 */
export const relativeDelta = (current: number, previous: number): Delta => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { kind: "stable", label: D.stable };
  }
  if (previous === 0) {
    return current === 0
      ? { kind: "stable", label: D.stable }
      : { kind: "new", label: D.new };
  }
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(percent) < STABLE_THRESHOLD) {
    return { kind: "stable", label: D.stable };
  }
  return signed(percent, "%");
};

/**
 * The change between two rates (ratios in [0, 1]) in percentage POINTS —
 * a relative change of a rate («the absence rate rose 40 %») misleads.
 * Null when either side has no rate.
 */
export const pointsDelta = (
  current: number | null,
  previous: number | null,
): Delta | null => {
  if (current === null || previous === null) return null;
  const points = (current - previous) * 100;
  if (!Number.isFinite(points) || Math.abs(points) < STABLE_THRESHOLD) {
    return { kind: "stable", label: D.stable };
  }
  return signed(points, D.pointsUnit);
};

// ── Formatters (the slice's own; money's full form is `formatDH`) ──────────

/** 0.0734 → «7,3 %». Null → «—». */
export const formatPercent = (ratio: number | null) =>
  ratio === null || !Number.isFinite(ratio)
    ? D.none
    : `${(Math.round(ratio * 1000) / 10).toString().replace(".", ",")}${NBSP}%`;

/**
 * Centimes → a compact axis label, the number never wider than ~4
 * characters (centimes in, whole dirhams out): 85 000 → «850 DH»,
 * 1 250 000 → «13 k DH», 95 000 000 → «950 k DH», 120 000 000 → «1,2 M DH». Whole dirhams only — an axis is not
 * a ledger; tooltips and cards use `formatDH`.
 */
export const formatCompactDH = (cents: number) => {
  const dh = Math.round(cents / 100);
  const abs = Math.abs(dh);
  const sign = dh < 0 ? MINUS : "";
  const scaled = (value: number, unit: string) => {
    const text =
      value < 10
        ? String(Math.round(value * 10) / 10).replace(".", ",")
        : String(Math.round(value));
    return `${sign}${text}${NBSP}${unit}${NBSP}${CURRENCY_SUFFIX}`;
  };

  if (abs < 1_000) return `${sign}${abs}${NBSP}${CURRENCY_SUFFIX}`;
  // 999 950 rounds to «1000 k»: promote it to «1 M» instead.
  if (abs < 999_500) return scaled(abs / 1_000, "k");
  return scaled(abs / 1_000_000, "M");
};

// ── Shares ──────────────────────────────────────────────────────────────────

/** A slice's share of a donut's total, as a ratio; 0 when the total is 0. */
export const shareOf = (part: number, total: number) =>
  total > 0 ? part / total : 0;
