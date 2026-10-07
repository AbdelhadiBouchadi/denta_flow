/**
 * FDI tooth numbering — the only accepted system (08-clinical.md §1). Two-digit
 * codes, quadrant first. Constants only: the odontogram itself is V1.1.
 *
 * Each quadrant is listed from the midline outwards (11 → 18), which is the
 * order a chart reads on the patient's right side of the screen.
 */
const quadrant = (q: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${q}${i + 1}`) as ToothCode[];

export const ADULT_TEETH: readonly ToothCode[] = [
  ...quadrant(1, 8),
  ...quadrant(2, 8),
  ...quadrant(3, 8),
  ...quadrant(4, 8),
];

export const CHILD_TEETH: readonly ToothCode[] = [
  ...quadrant(5, 5),
  ...quadrant(6, 5),
  ...quadrant(7, 5),
  ...quadrant(8, 5),
];

/**
 * Written out, not spread: `z.enum` needs a literal tuple, and a free
 * `z.string()` for a tooth is a bug (08-clinical.md §1).
 */
export const ALL_TEETH = [
  "11", "12", "13", "14", "15", "16", "17", "18",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "31", "32", "33", "34", "35", "36", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48",
  "51", "52", "53", "54", "55",
  "61", "62", "63", "64", "65",
  "71", "72", "73", "74", "75",
  "81", "82", "83", "84", "85",
] as const;

export type ToothCode = (typeof ALL_TEETH)[number];
