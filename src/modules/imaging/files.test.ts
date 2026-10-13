import { describe, expect, it } from "vitest";

import {
  IMAGE_MAX_BYTES,
  IMAGING_VALIDATION_MESSAGES as M,
} from "./constants";
import {
  buildImageFileName,
  buildUploadPathname,
  formatFileSize,
  imageDimensionsDenial,
  imageFileDenial,
  isPatientFilePathname,
  thumbnailSize,
} from "./files";
import { ImageContentType, PatientFileKind } from "./types";

const file = (type: string, size = 1000, name = "image.jpg") => ({ type, size, name });

describe("imageFileDenial — allowed types and size", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(imageFileDenial(file(type))).toBeNull();
  });

  it("rejects HEIC by type and by extension, with its own message", () => {
    expect(imageFileDenial(file("image/heic", 1000, "IMG_1.HEIC"))).toBe(M.heic);
    expect(imageFileDenial(file("", 1000, "IMG_1.heic"))).toBe(M.heic);
    expect(imageFileDenial(file("image/heif", 1000, "a.heif"))).toBe(M.heic);
  });

  it("rejects DICOM, even with no declared type", () => {
    expect(imageFileDenial(file("application/dicom", 1000, "pano.dcm"))).toBe(M.dicom);
    expect(imageFileDenial(file("", 1000, "PANO.DCM"))).toBe(M.dicom);
  });

  it("rejects any other type", () => {
    expect(imageFileDenial(file("image/gif", 1000, "a.gif"))).toBe(M.typeNotAllowed);
    expect(imageFileDenial(file("application/pdf", 1000, "a.pdf"))).toBe(M.typeNotAllowed);
    expect(imageFileDenial(file("image/svg+xml", 1000, "a.svg"))).toBe(M.typeNotAllowed);
  });

  it("accepts exactly 25 MB and rejects 25 MB + 1 byte", () => {
    expect(imageFileDenial(file("image/jpeg", IMAGE_MAX_BYTES))).toBeNull();
    expect(imageFileDenial(file("image/jpeg", IMAGE_MAX_BYTES + 1))).toBe(M.tooLarge);
  });

  it("rejects an empty file", () => {
    expect(imageFileDenial(file("image/png", 0, "a.png"))).toBe(M.empty);
  });
});

describe("imageDimensionsDenial", () => {
  it("accepts the bounds themselves", () => {
    expect(imageDimensionsDenial(64, 64)).toBeNull();
    expect(imageDimensionsDenial(12_000, 12_000)).toBeNull();
  });

  it("rejects 63 px on either side", () => {
    expect(imageDimensionsDenial(63, 500)).toBe(M.tooSmall);
    expect(imageDimensionsDenial(500, 63)).toBe(M.tooSmall);
  });

  it("rejects more than 12 000 px on either side", () => {
    expect(imageDimensionsDenial(12_001, 500)).toBe(M.tooBig);
    expect(imageDimensionsDenial(500, 12_001)).toBe(M.tooBig);
  });

  it("rejects a non-integer decode", () => {
    expect(imageDimensionsDenial(100.5, 100)).toBe(M.unreadable);
  });
});

describe("thumbnailSize", () => {
  it("scales a landscape image to 480 on its width", () => {
    expect(thumbnailSize(3000, 2000)).toEqual({ width: 480, height: 320 });
  });

  it("scales a portrait image to 480 on its height", () => {
    expect(thumbnailSize(1500, 4000)).toEqual({ width: 180, height: 480 });
  });

  it("never upscales an image already small", () => {
    expect(thumbnailSize(300, 200)).toEqual({ width: 300, height: 200 });
    expect(thumbnailSize(480, 480)).toEqual({ width: 480, height: 480 });
  });

  it("keeps at least one pixel on an extreme ratio", () => {
    expect(thumbnailSize(12_000, 64)).toEqual({ width: 480, height: 3 });
    expect(thumbnailSize(12_000, 10).height).toBeGreaterThanOrEqual(1);
  });
});

describe("pathnames", () => {
  const patientId = "p_AbC-123";
  const uuid = "0f8b3c2e-1d2a-4b5c-9e8f-7a6b5c4d3e2f";

  it("builds an original's and a thumbnail's requested pathname", () => {
    expect(
      buildUploadPathname({ patientId, uuid, contentType: ImageContentType.Png, isThumbnail: false }),
    ).toBe(`patients/${patientId}/${uuid}.png`);
    expect(
      buildUploadPathname({ patientId, uuid, contentType: ImageContentType.Png, isThumbnail: true }),
    ).toBe(`patients/${patientId}/${uuid}-thumb.jpg`);
  });

  it("accepts the requested pathname and the store's suffixed one", () => {
    expect(isPatientFilePathname(`patients/${patientId}/${uuid}.webp`, patientId)).toBe(true);
    expect(isPatientFilePathname(`patients/${patientId}/${uuid}-Xy7QpL2mN.jpg`, patientId)).toBe(true);
    expect(
      isPatientFilePathname(`patients/${patientId}/${uuid}-thumb-Xy7QpL2mN.jpg`, patientId, { thumbnail: true }),
    ).toBe(true);
  });

  it("rejects another patient's folder", () => {
    expect(isPatientFilePathname(`patients/other/${uuid}.jpg`, patientId)).toBe(false);
    // A prefix of the id is not the id.
    expect(isPatientFilePathname(`patients/${patientId}x/${uuid}.jpg`, patientId)).toBe(false);
  });

  it("rejects `..`, extra levels, backslashes and odd names", () => {
    expect(isPatientFilePathname(`patients/${patientId}/../other/${uuid}.jpg`, patientId)).toBe(false);
    expect(isPatientFilePathname(`patients/${patientId}/..jpg`, patientId)).toBe(false);
    expect(isPatientFilePathname(`patients/${patientId}/sub/${uuid}.jpg`, patientId)).toBe(false);
    expect(isPatientFilePathname(`patients/${patientId}/a\\b.jpg`, patientId)).toBe(false);
    expect(isPatientFilePathname(`patients/${patientId}/photo de moi.jpg`, patientId)).toBe(false);
    expect(isPatientFilePathname(`clinic/logo.png`, patientId)).toBe(false);
  });

  it("rejects a disallowed extension, and a non-JPEG thumbnail", () => {
    expect(isPatientFilePathname(`patients/${patientId}/${uuid}.gif`, patientId)).toBe(false);
    expect(isPatientFilePathname(`patients/${patientId}/${uuid}.html`, patientId)).toBe(false);
    expect(
      isPatientFilePathname(`patients/${patientId}/${uuid}-thumb.png`, patientId, { thumbnail: true }),
    ).toBe(false);
  });

  it("rejects a patient id that could escape the folder", () => {
    expect(isPatientFilePathname(`patients/../x.jpg`, "..")).toBe(false);
    expect(isPatientFilePathname(`patients/a/b/x.jpg`, "a/b")).toBe(false);
  });
});

describe("buildImageFileName", () => {
  // 2026-06-17 00:00 in Casablanca (UTC+1 outside Ramadan) = 16 June 23:00 UTC.
  const takenAt = new Date("2026-06-16T23:00:00Z");

  it("names kind, patient and the CLINIC date, with the stored extension", () => {
    expect(
      buildImageFileName({
        kind: PatientFileKind.Panoramic,
        firstName: "Amine",
        lastName: "Benali",
        takenAt,
        contentType: "image/jpeg",
      }),
    ).toBe("Panoramique_Amine_BENALI_17_06_2026.jpg");
  });

  it("folds accents and turns spaces and apostrophes into hyphens", () => {
    expect(
      buildImageFileName({
        kind: PatientFileKind.Periapical,
        firstName: "Aït Hélène",
        lastName: "El M'rani",
        takenAt,
        contentType: "image/png",
      }),
    ).toBe("Retro-alveolaire_Ait-Helene_EL-M-RANI_17_06_2026.png");
  });

  it("stays ASCII-only and never empty", () => {
    const name = buildImageFileName({
      kind: PatientFileKind.Photo,
      firstName: "“ ”",
      lastName: "日本",
      takenAt,
      contentType: "image/webp",
    });
    expect(name).toBe("Photo_Patient_PATIENT_17_06_2026.webp");
    expect(/^[\x20-\x7E]+$/.test(name)).toBe(true);
  });
});

describe("formatFileSize", () => {
  it("prints French units", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(1536)).toBe("1,5 Ko");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2,5 Mo");
  });
});
