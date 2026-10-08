/**
 * The PDF's own palette — the one place outside globals.css with colour
 * values (prompts/21). A printed page cannot read CSS custom properties, so
 * the values are plain: greys for text and rules, and the clinic's primary
 * (the brand teal, the same value as the `--teal` token) for the title rule.
 * Sober on purpose: it prints well in black and white.
 */
export const PDF_PALETTE = {
  text: "#1F2937",
  muted: "#6B7280",
  rule: "#D1D5DB",
  surface: "#F3F4F6",
  primary: "#0D9488",
} as const;
