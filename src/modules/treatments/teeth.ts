import { formatTooth } from "@/lib/format";
import {
  ADULT_TEETH,
  CHILD_TEETH,
  type ToothCode,
} from "@/modules/odontogram/constants";
import { MAX_VISIBLE_TEETH } from "./constants";
import { Dentition } from "./types";

/**
 * Pure tooth and amount rules, shared by the schema, the form, the grid and
 * the cells — and covered by Vitest.
 */

/**
 * Deduplicated and sorted. FDI codes are two digits, so the string order is
 * the numeric one: 11 … 48, then 51 … 85. Adult and child codes may be mixed
 * (mixed dentition).
 */
export const normalizeTeeth = <T extends string>(teeth: readonly T[]): T[] =>
  [...new Set(teeth)].sort();

/**
 * The amount the form SUGGESTS: the service's price per tooth. No tooth (a
 * consultation, a scaling) counts as one. The staff member may edit the total.
 */
export const suggestedTotalCents = (unitPriceCents: number, teethCount: number) =>
  unitPriceCents * Math.max(1, teethCount);

/** «Dent 26, Dent 27». */
export const formatTeethList = (teeth: readonly string[]) =>
  teeth.map(formatTooth).join(", ");

/** The first `MAX_VISIBLE_TEETH` teeth, and how many the «+N» hides. */
export const splitVisibleTeeth = (
  teeth: readonly string[],
  max = MAX_VISIBLE_TEETH,
) => ({
  visible: teeth.slice(0, max),
  hidden: Math.max(0, teeth.length - max),
});

// ── The dental-chart layout ─────────────────────────────────────────────────

/**
 * One arch as the chart draws it: the patient's RIGHT side on the screen's
 * left. Upper: 18 → 11 | 21 → 28. Lower: 48 → 41 | 31 → 38.
 */
export interface ArchLayout {
  right: ToothCode[];
  left: ToothCode[];
}

const inQuadrant = (teeth: readonly ToothCode[], quadrant: number) =>
  teeth.filter((tooth) => tooth.startsWith(String(quadrant)));

const archOf = (
  teeth: readonly ToothCode[],
  rightQuadrant: number,
  leftQuadrant: number,
): ArchLayout => ({
  right: inQuadrant(teeth, rightQuadrant).reverse(),
  left: inQuadrant(teeth, leftQuadrant),
});

export const CHART_LAYOUT: Record<
  Dentition,
  { upper: ArchLayout; lower: ArchLayout }
> = {
  [Dentition.Adult]: {
    upper: archOf(ADULT_TEETH, 1, 2),
    lower: archOf(ADULT_TEETH, 4, 3),
  },
  [Dentition.Child]: {
    upper: archOf(CHILD_TEETH, 5, 6),
    lower: archOf(CHILD_TEETH, 8, 7),
  },
};

export const archTeeth = ({ right, left }: ArchLayout) => [...right, ...left];

const CHILD_SET = new Set<string>(CHILD_TEETH);

/** The dentition the grid opens on: child only when every pick is a milk tooth. */
export const initialDentition = (teeth: readonly string[]) =>
  teeth.length > 0 && teeth.every((tooth) => CHILD_SET.has(tooth))
    ? Dentition.Child
    : Dentition.Adult;
