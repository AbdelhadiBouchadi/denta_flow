import "server-only";

import path from "node:path";

import { Font } from "@react-pdf/renderer";

/**
 * The PDFs' one typeface: Noto Sans (SIL OFL 1.1, fonts/OFL.txt), vendored
 * as static TTFs in three weights. The 14 standard PDF fonts are WinAnsi
 * only — no narrow no-break space (U+202F), no «’» in every viewer — and the
 * French typography the app prints needs both. Never strip characters to make
 * a standard font «work».
 *
 * The files are read from disk at render time; `next.config.ts` adds them to
 * the route handler's output trace so they ship with the function.
 */

export const PDF_FONT_FAMILY = "Noto Sans";

export const PDF_FONT_DIR = path.join(process.cwd(), "src", "lib", "pdf", "fonts");

export const PDF_FONT_FILES = {
  regular: "NotoSans-Regular.ttf",
  semibold: "NotoSans-SemiBold.ttf",
  bold: "NotoSans-Bold.ttf",
} as const;

let isRegistered = false;

/** Idempotent; called before every render. */
export const registerPdfFonts = () => {
  if (isRegistered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(PDF_FONT_DIR, PDF_FONT_FILES.regular), fontWeight: 400 },
      { src: path.join(PDF_FONT_DIR, PDF_FONT_FILES.semibold), fontWeight: 600 },
      { src: path.join(PDF_FONT_DIR, PDF_FONT_FILES.bold), fontWeight: 700 },
    ],
  });
  // react-pdf hyphenates with English rules by default, which splits French
  // words at the wrong places. A word is never split; it wraps whole.
  Font.registerHyphenationCallback((word) => [word]);
  isRegistered = true;
};
