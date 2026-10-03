import { ASSET_ACCEPTED_MIME_TYPES, type AssetMimeType } from "@/constants";

/**
 * Pure helpers for uploaded clinic assets. No `server-only`: the procedure
 * sniffs bytes with them, and branch 11's Zod schema runs `isClinicBlobUrl` on
 * both sides of the wire.
 */

/** Enough bytes to tell PNG, JPEG and WebP apart (WebP needs the first 12). */
export const ASSET_SNIFF_BYTES = 12;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * The real image type, read from the file's magic bytes — never from its name
 * or its client-declared `type`. `null` for anything else, SVG included.
 */
export function detectImageType(bytes: Uint8Array): AssetMimeType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  // RIFF container: "RIFF" <4-byte size> "WEBP".
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) {
    return "image/webp";
  }
  return null;
}

export function isAcceptedMimeType(value: string): value is AssetMimeType {
  return (ASSET_ACCEPTED_MIME_TYPES as readonly string[]).includes(value);
}

/** The host every public blob of this project is served from. */
const CLINIC_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Whether a URL points into a public Vercel Blob store. Matches on the parsed
 * hostname, so `…blob.vercel-storage.com.evil.com` and a suffix smuggled into
 * the path or the userinfo both fail.
 */
export function isClinicBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.hostname.endsWith(CLINIC_BLOB_HOST_SUFFIX) &&
    // A store subdomain must precede the suffix.
    parsed.hostname.length > CLINIC_BLOB_HOST_SUFFIX.length
  );
}

const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * 1024;

/** 843_776 → "824 Ko", 1_258_291 → "1,2 Mo", 4_194_304 → "4 Mo". */
export function formatFileSize(bytes: number): string {
  if (bytes < MEBIBYTE) {
    return `${Math.max(1, Math.round(bytes / KIBIBYTE))} Ko`;
  }
  const megabytes = (bytes / MEBIBYTE).toFixed(1).replace(/\.0$/, "");
  return `${megabytes.replace(".", ",")} Mo`;
}
