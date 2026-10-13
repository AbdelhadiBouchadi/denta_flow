import { describe, expect, it } from "vitest";

import { StaffRole } from "@/modules/staff/types";
import { IMAGING_SERVER_ERRORS as E } from "./constants";
import {
  canReadImaging,
  canRemoveImaging,
  canWriteImaging,
  imagingRemoveDenial,
  imagingWriteDenial,
} from "./rules";

const live = { patientIsArchived: false };
const archived = { patientIsArchived: true };

describe("imaging role rule (prompts/31, decision 3)", () => {
  it.each([StaffRole.Admin, StaffRole.Dentist, StaffRole.Assistant])(
    "%s may read, upload and edit",
    (role) => {
      expect(canReadImaging(role)).toBe(true);
      expect(canWriteImaging({ role, ...live })).toBe(true);
    },
  );

  it("denies the secretary everything", () => {
    const role = StaffRole.Secretary;
    expect(canReadImaging(role)).toBe(false);
    expect(imagingWriteDenial({ role, ...live })).toBe(E.forbidden);
    expect(canRemoveImaging({ role, ...live })).toBe(false);
  });

  it("denies an unknown or still-loading session", () => {
    expect(canReadImaging(undefined)).toBe(false);
    expect(canReadImaging(null)).toBe(false);
    expect(canReadImaging("owner")).toBe(false);
  });

  it("makes an archived dossier read-only for every role", () => {
    for (const role of [StaffRole.Admin, StaffRole.Dentist, StaffRole.Assistant]) {
      expect(canReadImaging(role)).toBe(true);
      expect(imagingWriteDenial({ role, ...archived })).toBe(E.archived);
      expect(canRemoveImaging({ role, ...archived })).toBe(false);
    }
  });

  it("tells a secretary about the role, not the archive", () => {
    expect(imagingWriteDenial({ role: StaffRole.Secretary, ...archived })).toBe(E.forbidden);
  });

  it("lets only the admin remove", () => {
    expect(canRemoveImaging({ role: StaffRole.Admin, ...live })).toBe(true);
    expect(imagingRemoveDenial({ role: StaffRole.Dentist, ...live })).toBe(E.removeForbidden);
    expect(imagingRemoveDenial({ role: StaffRole.Assistant, ...live })).toBe(E.removeForbidden);
    expect(imagingRemoveDenial({ role: StaffRole.Admin, ...archived })).toBe(E.archived);
  });
});
