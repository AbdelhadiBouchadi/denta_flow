/**
 * The design-system palette (06-ui.md §1) as stored values. Staff use it for
 * their agenda tint, tags for their pill colour.
 *
 * A plain module, not part of `color-picker.tsx`: that file is "use client",
 * and a server-side Zod schema importing from it would receive a client
 * reference instead of the array. The picker re-exports it unchanged.
 *
 * These are the one place a hex sits outside `globals.css`, and on purpose:
 * they are not styling but the values written to a `color` column, which the
 * agenda and printed documents read back as data. A CSS variable cannot be
 * stored, and a token re-themed for dark mode would repaint saved rows. Each
 * value is the light-theme hex of the token named beside it. Upper-case,
 * matching the schemas' normalisation.
 */
export const COLOR_PALETTE = [
  { value: "#0D9488", label: "Sarcelle" }, // --teal
  { value: "#0F766E", label: "Sarcelle foncé" }, // --teal-dark
  { value: "#2563EB", label: "Bleu" }, // --info
  { value: "#16A34A", label: "Vert" }, // --success
  { value: "#D97706", label: "Ambre" }, // --warning
  { value: "#DC2626", label: "Rouge" }, // --danger
  { value: "#1E293B", label: "Ardoise" }, // --slate-blue
  { value: "#475569", label: "Gris ardoise" }, // --ink-secondary
] as const;

export type PaletteColor = (typeof COLOR_PALETTE)[number]["value"];

export const PALETTE_COLORS = COLOR_PALETTE.map((swatch) => swatch.value) as [
  PaletteColor,
  ...PaletteColor[],
];
