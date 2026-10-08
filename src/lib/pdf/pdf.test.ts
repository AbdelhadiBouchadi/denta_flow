import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// The modules under test are server-only; the guard throws outside Next.
vi.mock("server-only", () => ({}));

import { formatDH } from "@/lib/format";
import { BillingDocument, type BillingDocumentProps } from "./billing-document";
import { PDF_FONT_DIR, PDF_FONT_FILES, registerPdfFonts } from "./fonts";

/**
 * The vendored font must carry every character the PDFs print — the amount
 * as `formatDH` writes it, French accents and typography. A missing glyph
 * renders as an empty box in the PDF, silently.
 */
const SAMPLES = [
  formatDH(400000),
  "Réglé à ce jour · Reste à payer · Avance",
  "Valable jusqu’au « Cachet et signature » N° Étienne Ça Œuvre ïôûèêëàâç",
  // The French spaces: no-break and narrow no-break.
  String.fromCodePoint(0x00a0, 0x202f),
];

/**
 * Whether a TrueType font maps a BMP code point to a glyph, read from its
 * `cmap` table (the Windows Unicode BMP subtable, format 4). Read by hand so
 * the test needs no font library of its own.
 */
const hasGlyph = (font: Buffer) => {
  const tableCount = font.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tableCount; i++) {
    const record = 12 + i * 16;
    if (font.toString("latin1", record, record + 4) === "cmap") {
      cmap = font.readUInt32BE(record + 8);
    }
  }
  if (cmap < 0) throw new Error("no cmap table");

  let subtable = -1;
  const subtableCount = font.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtableCount; i++) {
    const record = cmap + 4 + i * 8;
    const [platform, encoding] = [font.readUInt16BE(record), font.readUInt16BE(record + 2)];
    const offset = cmap + font.readUInt32BE(record + 4);
    if (platform === 3 && encoding === 1 && font.readUInt16BE(offset) === 4) {
      subtable = offset;
    }
  }
  if (subtable < 0) throw new Error("no format 4 cmap subtable");

  const segments = font.readUInt16BE(subtable + 6) / 2;
  const ends = subtable + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;

  return (codePoint: number) => {
    for (let s = 0; s < segments; s++) {
      if (codePoint > font.readUInt16BE(ends + s * 2)) continue;
      const start = font.readUInt16BE(starts + s * 2);
      if (codePoint < start) return false;
      const delta = font.readInt16BE(deltas + s * 2);
      const rangeOffsetAt = rangeOffsets + s * 2;
      const rangeOffset = font.readUInt16BE(rangeOffsetAt);
      if (rangeOffset === 0) return ((codePoint + delta) & 0xffff) !== 0;
      const glyph = font.readUInt16BE(
        rangeOffsetAt + rangeOffset + (codePoint - start) * 2,
      );
      return glyph !== 0;
    }
    return false;
  };
};

describe("PDF fonts", () => {
  it.each(Object.values(PDF_FONT_FILES))("%s covers the printed characters", (file) => {
    const covers = hasGlyph(readFileSync(path.join(PDF_FONT_DIR, file)));
    const missing = [...new Set(SAMPLES.join(""))].filter(
      (char) => !covers(char.codePointAt(0)!),
    );
    expect(missing).toEqual([]);
  });

  it("the cmap reader does report a missing glyph", () => {
    const covers = hasGlyph(
      readFileSync(path.join(PDF_FONT_DIR, PDF_FONT_FILES.regular)),
    );
    // A private-use code point no text font maps.
    expect(covers(0xe000)).toBe(false);
    expect(covers("A".codePointAt(0)!)).toBe(true);
  });

  it("formats the amount the way the page prints it", () => {
    expect(formatDH(400000)).toBe("4 000,00 DH");
  });
});

const props: BillingDocumentProps = {
  documentTitle: "FACTURE N° F-2026-0001",
  author: "Cabinet",
  header: { logo: null, name: "Cabinet", lines: ["Agadir"], identifiers: "" },
  title: "FACTURE N° F-2026-0001",
  details: [{ label: "Date", value: "17/06/2026" }],
  recipient: { heading: "Patient", lines: ["BENALI Karim", "Dossier W6U8"] },
  columns: [
    { key: "label", label: "Acte", width: "70%" },
    { key: "amount", label: "Montant", width: "30%", align: "right" },
  ],
  rows: Array.from({ length: 3 }, (_, index) => ({
    key: String(index),
    cells: { label: "Détartrage", amount: formatDH(400000) },
  })),
  totals: [{ label: "Total", value: formatDH(1200000), emphasis: true }],
  situation: { caption: "Situation du compte au 17/06/2026", rows: [] },
  mentions: [],
  signature: { lines: ["Dr Test"], label: "Cachet et signature" },
  pageLabel: (page, total) => `Page ${page}/${total}`,
};

describe("BillingDocument", () => {
  it("renders a PDF with the registered font, a logo-less header included", async () => {
    registerPdfFonts();
    const buffer = await renderToBuffer(createElement(BillingDocument, props));
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
    // The TTF is embedded (subset) — not a standard font fallback.
    expect(buffer.toString("latin1")).toContain("NotoSans");
  }, 30_000);
});
