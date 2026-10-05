import { describe, expect, it } from "vitest";

import { STAFF_SERVER_ERRORS } from "./constants";
import { lastAdminError, roleChangeKind, selfChangeError } from "./guards";
import { StaffChange, StaffRole } from "./types";

describe("roleChangeKind", () => {
  it("treats granting admin as no threat to the admin headcount", () => {
    expect(roleChangeKind(StaffRole.Admin)).toBeNull();
  });

  it("treats every other role as a possible demotion", () => {
    for (const role of [
      StaffRole.Dentist,
      StaffRole.Assistant,
      StaffRole.Secretary,
    ]) {
      expect(roleChangeKind(role)).toBe(StaffChange.Demote);
    }
  });
});

describe("selfChangeError", () => {
  it("refuses demoting oneself", () => {
    expect(selfChangeError("a", "a", StaffChange.Demote)).toBe(
      STAFF_SERVER_ERRORS.selfDemote,
    );
  });

  it("refuses deactivating oneself", () => {
    expect(selfChangeError("a", "a", StaffChange.Deactivate)).toBe(
      STAFF_SERVER_ERRORS.selfDeactivate,
    );
  });

  it("allows the same change on someone else", () => {
    expect(selfChangeError("a", "b", StaffChange.Demote)).toBeNull();
    expect(selfChangeError("a", "b", StaffChange.Deactivate)).toBeNull();
  });

  it("allows an admin to re-grant themselves admin", () => {
    expect(
      selfChangeError("a", "a", roleChangeKind(StaffRole.Admin)),
    ).toBeNull();
  });
});

describe("lastAdminError", () => {
  it("names the change that was refused", () => {
    expect(lastAdminError(StaffChange.Demote)).toBe(
      STAFF_SERVER_ERRORS.lastAdminDemote,
    );
    expect(lastAdminError(StaffChange.Deactivate)).toBe(
      STAFF_SERVER_ERRORS.lastAdminDeactivate,
    );
  });
});

describe("STAFF_SERVER_ERRORS", () => {
  it("is French copy, never English debug text", () => {
    for (const message of Object.values(STAFF_SERVER_ERRORS)) {
      expect(message.trim()).not.toBe("");
      expect(message).not.toMatch(
        /\b(user|admin|not found|failed|already exists|cannot|error)\b/i,
      );
    }
  });
});
