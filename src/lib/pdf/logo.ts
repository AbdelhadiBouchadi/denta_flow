import "server-only";

import { ASSET_MAX_BYTES } from "@/constants";
import { detectImageType, isClinicBlobUrl } from "@/lib/assets";

/** What react-pdf's <Image> accepts as an in-memory source. */
export interface PdfImage {
  data: Buffer;
  format: "png" | "jpg";
}

/**
 * The clinic logo for a PDF header, or `null` — and `null` on ANY failure: a
 * missing logo must never break an invoice (prompts/21, decision 8).
 *
 * - Only a URL inside the project's public Blob store is fetched, so a
 *   stored URL can never make the server request an arbitrary host.
 * - Bounded by `timeoutMs` and by the upload size limit.
 * - The bytes are sniffed: react-pdf draws PNG and JPEG only, so a WebP logo
 *   is skipped (text-only header) rather than failing the render.
 */
export const loadPdfLogo = async (
  url: string | null,
  timeoutMs: number,
): Promise<PdfImage | null> => {
  if (!url || !isClinicBlobUrl(url)) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > ASSET_MAX_BYTES) return null;
    const type = detectImageType(bytes);
    if (type === "image/png") return { data: Buffer.from(bytes), format: "png" };
    if (type === "image/jpeg") return { data: Buffer.from(bytes), format: "jpg" };
    return null;
  } catch {
    return null;
  }
};
