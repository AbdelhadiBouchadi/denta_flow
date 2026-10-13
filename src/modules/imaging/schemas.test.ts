import { describe, expect, it } from "vitest";

import { addCalendarDays, toClinicDate } from "@/lib/time";
import { IMAGING_VALIDATION_MESSAGES as M } from "./constants";
import {
  imagingByPatientSchema,
  imagingMetadataSchema,
  imagingRegisterSchema,
  uploadClientPayloadSchema,
} from "./schemas";
import { PatientFileKind } from "./types";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("uploadClientPayloadSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(
      uploadClientPayloadSchema.safeParse({
        patientId: "p1",
        kind: PatientFileKind.Panoramic,
        isThumbnail: false,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown kind, a missing flag, an empty patient and extra keys", () => {
    const base = { patientId: "p1", kind: PatientFileKind.Photo, isThumbnail: true };
    expect(uploadClientPayloadSchema.safeParse({ ...base, kind: "panoramique" }).success).toBe(false);
    expect(uploadClientPayloadSchema.safeParse({ patientId: "p1", kind: "photo" }).success).toBe(false);
    expect(uploadClientPayloadSchema.safeParse({ ...base, patientId: "" }).success).toBe(false);
    // Strict: the payload cannot smuggle a pathname or a size.
    expect(uploadClientPayloadSchema.safeParse({ ...base, pathname: "x" }).success).toBe(false);
  });
});

describe("imagingMetadataSchema", () => {
  const today = toClinicDate(new Date());

  it("accepts today and turns an empty note into null", () => {
    const result = imagingMetadataSchema.parse({
      kind: PatientFileKind.Other,
      takenDate: today,
      notes: "   ",
    });
    expect(result.notes).toBeNull();
  });

  it("refuses a future clinic day and a malformed date", () => {
    const tomorrow = addCalendarDays(today, 1);
    expect(
      firstMessage(
        imagingMetadataSchema.safeParse({ kind: PatientFileKind.Other, takenDate: tomorrow }),
      ),
    ).toBe(M.inFuture);
    expect(
      firstMessage(
        imagingMetadataSchema.safeParse({ kind: PatientFileKind.Other, takenDate: "2026-02-30" }),
      ),
    ).toBe(M.dateInvalid);
  });
});

describe("imagingRegisterSchema", () => {
  const valid = {
    patientId: "p1",
    kind: PatientFileKind.Panoramic,
    takenDate: "2026-01-05",
    notes: null,
    original: {
      pathname: "patients/p1/abc.jpg",
      name: "pano.jpg",
      width: 2800,
      height: 1400,
      sizeBytes: 1_200_000,
      contentType: "image/jpeg",
    },
    thumbnail: { pathname: "patients/p1/abc-thumb.jpg" },
  };

  it("accepts a register with and without a thumbnail", () => {
    expect(imagingRegisterSchema.safeParse(valid).success).toBe(true);
    expect(imagingRegisterSchema.safeParse({ ...valid, thumbnail: null }).success).toBe(true);
  });

  it("rejects HEIC content, 63 px and 25 MB + 1 byte", () => {
    const original = (patch: object) => ({ ...valid, original: { ...valid.original, ...patch } });
    expect(firstMessage(imagingRegisterSchema.safeParse(original({ contentType: "image/heic" })))).toBe(
      M.typeNotAllowed,
    );
    expect(firstMessage(imagingRegisterSchema.safeParse(original({ width: 63 })))).toBe(M.tooSmall);
    expect(
      firstMessage(imagingRegisterSchema.safeParse(original({ sizeBytes: 25 * 1024 * 1024 + 1 }))),
    ).toBe(M.tooLarge);
  });
});

describe("imagingByPatientSchema", () => {
  it("takes `kind: null` — what nuqs holds when no chip is active", () => {
    expect(imagingByPatientSchema.safeParse({ patientId: "p1", kind: null }).success).toBe(true);
  });
});
