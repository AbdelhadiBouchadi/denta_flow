import { describe, expect, it } from "vitest";

import {
  detectImageType,
  formatFileSize,
  isAcceptedMimeType,
  isClinicBlobUrl,
} from "./assets";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

const PNG_HEADER = bytes(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
);
const JPEG_HEADER = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const WEBP_HEADER = new Uint8Array([
  ...ascii("RIFF"),
  0x24,
  0x00,
  0x00,
  0x00,
  ...ascii("WEBP"),
]);

describe("detectImageType", () => {
  it("recognises real PNG, JPEG and WebP headers", () => {
    expect(detectImageType(PNG_HEADER)).toBe("image/png");
    expect(detectImageType(JPEG_HEADER)).toBe("image/jpeg");
    expect(detectImageType(WEBP_HEADER)).toBe("image/webp");
  });

  it("rejects a text file renamed to .png", () => {
    expect(detectImageType(ascii("Bonjour, ceci n’est pas une image"))).toBe(
      null,
    );
  });

  it("rejects SVG, even with an XML prolog", () => {
    expect(
      detectImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBe(null);
    expect(detectImageType(ascii('<?xml version="1.0"?><svg>'))).toBe(null);
  });

  it("rejects truncated headers", () => {
    expect(detectImageType(new Uint8Array())).toBe(null);
    expect(detectImageType(PNG_HEADER.slice(0, 7))).toBe(null);
    expect(detectImageType(JPEG_HEADER.slice(0, 2))).toBe(null);
    expect(detectImageType(WEBP_HEADER.slice(0, 11))).toBe(null);
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = new Uint8Array([
      ...ascii("RIFF"),
      0x24,
      0x00,
      0x00,
      0x00,
      ...ascii("WAVE"),
    ]);
    expect(detectImageType(wav)).toBe(null);
  });
});

describe("isAcceptedMimeType", () => {
  it("accepts exactly PNG, JPEG and WebP", () => {
    expect(isAcceptedMimeType("image/png")).toBe(true);
    expect(isAcceptedMimeType("image/jpeg")).toBe(true);
    expect(isAcceptedMimeType("image/webp")).toBe(true);
    expect(isAcceptedMimeType("image/svg+xml")).toBe(false);
    expect(isAcceptedMimeType("image/gif")).toBe(false);
    expect(isAcceptedMimeType("")).toBe(false);
  });
});

describe("isClinicBlobUrl", () => {
  it("accepts a public blob store URL", () => {
    expect(
      isClinicBlobUrl(
        "https://abc123xyz.public.blob.vercel-storage.com/clinic/logo-Xy12.png",
      ),
    ).toBe(true);
  });

  it("rejects lookalike hosts", () => {
    expect(
      isClinicBlobUrl(
        "https://abc.public.blob.vercel-storage.com.evil.com/logo.png",
      ),
    ).toBe(false);
    expect(
      isClinicBlobUrl("https://blob.vercel-storage.com.evil.com/logo.png"),
    ).toBe(false);
    expect(
      isClinicBlobUrl("https://evilpublic.blob.vercel-storage.com/logo.png"),
    ).toBe(false);
    expect(
      isClinicBlobUrl("https://.public.blob.vercel-storage.com/logo.png"),
    ).toBe(false);
  });

  it("rejects the suffix smuggled outside the hostname", () => {
    expect(
      isClinicBlobUrl(
        "https://evil.com/x.public.blob.vercel-storage.com/logo.png",
      ),
    ).toBe(false);
    expect(
      isClinicBlobUrl(
        "https://abc.public.blob.vercel-storage.com@evil.com/logo.png",
      ),
    ).toBe(false);
    expect(
      isClinicBlobUrl(
        "https://user:pass@abc.public.blob.vercel-storage.com/logo.png",
      ),
    ).toBe(false);
  });

  it("rejects private stores, plain http and non-URLs", () => {
    expect(
      isClinicBlobUrl("https://abc.private.blob.vercel-storage.com/logo.png"),
    ).toBe(false);
    expect(
      isClinicBlobUrl("http://abc.public.blob.vercel-storage.com/logo.png"),
    ).toBe(false);
    expect(isClinicBlobUrl("blob:http://localhost:3000/1234")).toBe(false);
    expect(isClinicBlobUrl("pas une url")).toBe(false);
    expect(isClinicBlobUrl("")).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("renders kilo-octets below one mega-octet", () => {
    expect(formatFileSize(843_776)).toBe("824 Ko");
    expect(formatFileSize(12)).toBe("1 Ko");
  });

  it("renders mega-octets with a French decimal comma", () => {
    expect(formatFileSize(1_258_291)).toBe("1,2 Mo");
    expect(formatFileSize(4 * 1024 * 1024)).toBe("4 Mo");
  });
});
