import { z } from "zod";

import { isCalendarDate, toClinicDate } from "@/lib/time";
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_MIN_DIMENSION,
  IMAGING_NOTES_MAX,
  IMAGING_VALIDATION_MESSAGES as M,
  ORIGINAL_NAME_MAX,
  PATIENT_FILE_KIND_VALUES,
} from "./constants";
import { ImageContentType } from "./types";

/**
 * One schema per contract, shared by the procedure's `.input()`, the forms'
 * `zodResolver` and the upload route. Every message is French copy.
 *
 * `takenDate` travels as a clinic calendar day ("yyyy-MM-dd") and becomes
 * the clinic-midnight instant `takenAt` on the server only, through the
 * clinic timezone — the `spentDate` / `spentAt` pattern of the expenses
 * slice. No offset is computed in the browser.
 */

const patientId = z.string().min(1, { message: M.patientRequired });
const id = z.string().min(1, { message: M.idRequired });
const kind = z.enum(PATIENT_FILE_KIND_VALUES, { message: M.kindInvalid });

/** «Today» is read when the schema runs, on the CLINIC calendar. */
const takenDate = z
  .string()
  .refine(isCalendarDate, { message: M.dateInvalid })
  .refine((day) => day <= toClinicDate(new Date()), { message: M.inFuture });

const notes = z
  .string()
  .trim()
  .max(IMAGING_NOTES_MAX, { message: M.notesTooLong })
  .nullish()
  .transform((value) => (value ? value : null));

const dimension = z
  .number()
  .int({ message: M.unreadable })
  .min(IMAGE_MIN_DIMENSION, { message: M.tooSmall })
  .max(IMAGE_MAX_DIMENSION, { message: M.tooBig });

// ── Upload route ────────────────────────────────────────────────────────────

/**
 * The `clientPayload` the browser sends with each upload, as a JSON string.
 * Parsed by `POST /api/files/upload` before any token is signed.
 */
export const uploadClientPayloadSchema = z.strictObject({
  patientId,
  kind,
  isThumbnail: z.boolean(),
});

export type UploadClientPayload = z.output<typeof uploadClientPayloadSchema>;

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * `kind: null` ⇒ every kind. The dossier page and the tab build this input
 * from the same nuqs state (params.ts ↔ use-imaging-filters.ts), so the
 * prefetched key and the client's key are identical.
 */
export const imagingByPatientSchema = z.object({
  patientId,
  kind: kind.nullish(),
});

// ── Metadata: one form for the upload rows and the viewer's edit ────────────

export const imagingMetadataSchema = z.object({
  kind,
  takenDate,
  notes,
});

export type ImagingMetadataFormValues = z.input<typeof imagingMetadataSchema>;
export type ImagingMetadataValues = z.output<typeof imagingMetadataSchema>;

/** The upload dialog: one metadata row per picked file. */
export const imagingUploadItemSchema = imagingMetadataSchema.extend({
  /** The row's client-side key, linking it to its picked `File`. */
  key: z.string(),
});

export const imagingUploadFormSchema = z.object({
  items: z.array(imagingUploadItemSchema),
});

export type ImagingUploadItem = z.output<typeof imagingUploadItemSchema>;

export type ImagingUploadFormValues = z.input<typeof imagingUploadFormSchema>;

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * After the browser uploaded the bytes, it asks the server to record them.
 * `sizeBytes` and `contentType` are what the browser sent; `register`
 * compares them with what `head()` reads from the store. `width` / `height`
 * are the browser's decode — the server cannot check them without
 * downloading the file, so they are range-checked only.
 */
export const imagingRegisterSchema = imagingMetadataSchema.extend({
  patientId,
  original: z.object({
    pathname: z.string().min(1, { message: M.pathnameInvalid }),
    name: z
      .string()
      .trim()
      .min(1, { message: M.nameInvalid })
      .max(ORIGINAL_NAME_MAX, { message: M.nameInvalid }),
    width: dimension,
    height: dimension,
    sizeBytes: z
      .number()
      .int({ message: M.sizeInvalid })
      .positive({ message: M.empty })
      .max(IMAGE_MAX_BYTES, { message: M.tooLarge }),
    contentType: z.enum(ImageContentType, { message: M.typeNotAllowed }),
  }),
  thumbnail: z
    .object({ pathname: z.string().min(1, { message: M.pathnameInvalid }) })
    .nullish(),
});

export type ImagingRegisterValues = z.output<typeof imagingRegisterSchema>;

/**
 * Metadata edit + the version token the viewer loaded: a stale one is a
 * CONFLICT, never an overwrite.
 */
export const imagingUpdateSchema = imagingMetadataSchema.extend({
  id,
  expectedUpdatedAt: z.date(),
});

export const imagingIdSchema = z.object({ id });
