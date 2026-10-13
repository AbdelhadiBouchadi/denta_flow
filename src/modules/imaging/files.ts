import { toClinicTime, type ClinicDateInput } from "@/lib/time";
import { toFileNamePart } from "@/modules/documents/file-name";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_MIN_DIMENSION,
  IMAGING_VALIDATION_MESSAGES as M,
  PATIENT_FILE_KIND_LABELS,
  THUMBNAIL_LONG_SIDE,
} from "./constants";
import { ImageContentType, type PatientFileKind } from "./types";

/**
 * The slice's file logic, pure and isomorphic: the browser runs it before an
 * upload starts, the upload route and `register` run it again. Covered by
 * files.test.ts.
 */

// ── Allowed content (prompts/31, decision 5) ────────────────────────────────

export const isImageContentType = (value: string): value is ImageContentType =>
  (IMAGE_CONTENT_TYPES as readonly string[]).includes(value);

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
};

const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const DICOM_TYPES = new Set(["application/dicom", "application/dicom+json"]);
const DICOM_EXTENSIONS = new Set(["dcm", "dicom"]);

/**
 * Why a picked file cannot be uploaded, in French — or `null`. HEIC and
 * DICOM get their own message: they are what a phone and an X-ray unit
 * produce, and «format non pris en charge» alone does not say what to do.
 * The browser's declared `type` may be empty (a `.dcm` usually is), so the
 * extension is read as well.
 */
export const imageFileDenial = ({
  type,
  size,
  name,
}: {
  type: string;
  size: number;
  name: string;
}) => {
  const extension = extensionOf(name);
  if (HEIC_TYPES.has(type) || HEIC_EXTENSIONS.has(extension)) return M.heic;
  if (DICOM_TYPES.has(type) || DICOM_EXTENSIONS.has(extension)) return M.dicom;
  if (!isImageContentType(type)) return M.typeNotAllowed;
  if (size <= 0) return M.empty;
  if (size > IMAGE_MAX_BYTES) return M.tooLarge;
  return null;
};

/** Why decoded pixel dimensions are refused — or `null`. */
export const imageDimensionsDenial = (width: number, height: number) => {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return M.unreadable;
  if (width < IMAGE_MIN_DIMENSION || height < IMAGE_MIN_DIMENSION) return M.tooSmall;
  if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) return M.tooBig;
  return null;
};

// ── Thumbnails (decision 8) ─────────────────────────────────────────────────

/**
 * The thumbnail's size: the long side scaled down to `max`, the ratio kept,
 * each side at least 1 px. An image already within `max` keeps its size —
 * a thumbnail is never upscaled.
 */
export const thumbnailSize = (
  width: number,
  height: number,
  max: number = THUMBNAIL_LONG_SIDE,
) => {
  const longSide = Math.max(width, height);
  if (longSide <= max) return { width, height };
  const scale = max / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

// ── Pathnames (decision 2) ──────────────────────────────────────────────────
//
// `patients/{patientId}/{uuid}.{ext}` for an original and
// `patients/{patientId}/{uuid}-thumb.jpg` for its thumbnail, as REQUESTED by
// the browser. The upload route then forces `addRandomSuffix`, so the store
// appends its own random suffix server-side (`…/{uuid}-AbC123.jpg`) and the
// stored name is unpredictable whatever the client sent. The user's own
// filename never appears in a pathname.

export const patientFilePrefix = (patientId: string) => `patients/${patientId}/`;

/** The pathname the browser asks to upload to. */
export const buildUploadPathname = ({
  patientId,
  uuid,
  contentType,
  isThumbnail,
}: {
  patientId: string;
  uuid: string;
  contentType: ImageContentType;
  isThumbnail: boolean;
}) =>
  isThumbnail
    ? `${patientFilePrefix(patientId)}${uuid}-thumb.${IMAGE_EXTENSIONS[ImageContentType.Jpeg]}`
    : `${patientFilePrefix(patientId)}${uuid}.${IMAGE_EXTENSIONS[contentType]}`;

/** Patient ids are nanoids: letters, digits, `_` and `-`. */
const PATIENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
/** One path segment: a uuid, optional `-thumb`, optional store suffix. */
const FILE_SEGMENT_PATTERN = /^[A-Za-z0-9-]+\.(jpg|png|webp)$/;

/**
 * Whether `pathname` is a file of THIS patient's folder: exactly
 * `patients/{patientId}/{segment}`, no `..`, no extra level, no other
 * patient, an allowed extension. `thumbnail` also requires a `.jpg`.
 */
export const isPatientFilePathname = (
  pathname: string,
  patientId: string,
  { thumbnail = false }: { thumbnail?: boolean } = {},
) => {
  if (!PATIENT_ID_PATTERN.test(patientId)) return false;
  if (pathname.includes("..") || pathname.includes("\\")) return false;
  const prefix = patientFilePrefix(patientId);
  if (!pathname.startsWith(prefix)) return false;
  const segment = pathname.slice(prefix.length);
  if (!FILE_SEGMENT_PATTERN.test(segment)) return false;
  return !thumbnail || segment.endsWith(".jpg");
};

// ── Download filename ───────────────────────────────────────────────────────

const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * `Panoramique_Amine_BENALI_17_06_2026.jpg` — kind, patient, the clinic date
 * the image was taken, and the stored type's extension. ASCII-only through
 * the documents slice's `toFileNamePart` (accents folded, any other run of
 * characters one hyphen), so it is safe in a `Content-Disposition` header.
 */
export const buildImageFileName = ({
  kind,
  firstName,
  lastName,
  takenAt,
  contentType,
}: {
  kind: PatientFileKind;
  firstName: string;
  lastName: string;
  takenAt: ClinicDateInput;
  contentType: string;
}) => {
  const local = toClinicTime(takenAt);
  const date = `${pad2(local.getDate())}_${pad2(local.getMonth() + 1)}_${local.getFullYear()}`;
  const label = toFileNamePart(PATIENT_FILE_KIND_LABELS[kind] ?? "", "Image");
  const first = toFileNamePart(firstName, "Patient");
  const last = toFileNamePart(lastName, "Patient").toUpperCase();
  const extension = isImageContentType(contentType)
    ? IMAGE_EXTENSIONS[contentType]
    : "bin";
  return `${label}_${first}_${last}_${date}.${extension}`;
};

// ── Display ─────────────────────────────────────────────────────────────────

const sizeNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 2 516 582 → «2,4 Mo» — French units (octet, Ko, Mo), a comma decimal. */
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${sizeNumber.format(bytes / 1024)} Ko`;
  return `${sizeNumber.format(bytes / (1024 * 1024))} Mo`;
};
