import { describe, expect, it } from "vitest";

import { StaffRole } from "@/modules/staff/types";
import { ODONTOGRAM_SERVER_ERRORS as E } from "./constants";
import {
  canResetOdontogram,
  canWriteOdontogram,
  odontogramResetDenial,
  odontogramWriteDenial,
  planChartWrite,
  versionAgrees,
} from "./rules";

// ── Who may do what (prompts/28, decision 4) ────────────────────────────────

const WRITE: [StaffRole, boolean][] = [
  [StaffRole.Admin, true],
  [StaffRole.Dentist, true],
  [StaffRole.Assistant, true],
  [StaffRole.Secretary, false],
];

const RESET: [StaffRole, boolean][] = [
  [StaffRole.Admin, true],
  [StaffRole.Dentist, true],
  [StaffRole.Assistant, false],
  [StaffRole.Secretary, false],
];

describe("saving the chart", () => {
  it.each(WRITE)("%s on an active dossier → %s", (role, allowed) => {
    expect(canWriteOdontogram({ role, patientIsArchived: false })).toBe(
      allowed,
    );
    expect(odontogramWriteDenial({ role, patientIsArchived: false })).toBe(
      allowed ? null : E.writeForbidden,
    );
  });

  it.each(WRITE)("%s on an archived dossier → refused", (role) => {
    expect(canWriteOdontogram({ role, patientIsArchived: true })).toBe(false);
    // The archive is the reason given, even to an admin.
    expect(odontogramWriteDenial({ role, patientIsArchived: true })).toBe(
      E.archived,
    );
  });

  it("refuses while the role is unknown (session still loading)", () => {
    expect(
      canWriteOdontogram({ role: undefined, patientIsArchived: false }),
    ).toBe(false);
    expect(
      canWriteOdontogram({ role: "intern", patientIsArchived: false }),
    ).toBe(false);
  });
});

describe("resetting the chart", () => {
  it.each(RESET)("%s on an active dossier → %s", (role, allowed) => {
    expect(canResetOdontogram({ role, patientIsArchived: false })).toBe(
      allowed,
    );
    expect(odontogramResetDenial({ role, patientIsArchived: false })).toBe(
      allowed ? null : E.resetForbidden,
    );
  });

  it.each(RESET)("%s on an archived dossier → refused", (role) => {
    expect(odontogramResetDenial({ role, patientIsArchived: true })).toBe(
      E.archived,
    );
  });
});

// ── The first-save rule (decision 1) ────────────────────────────────────────

describe("planChartWrite", () => {
  const chart = { version: 1, library: "2.5.0", data: { teeth: {} } };

  it("first save: writes initial AND current, the same chart", () => {
    expect(planChartWrite(null, chart)).toEqual({
      kind: "insert",
      initial: chart,
      current: chart,
    });
  });

  it("later saves: current only — initial is never in the write", () => {
    const write = planChartWrite({ id: "c1" }, chart);
    expect(write).toEqual({ kind: "update", id: "c1", current: chart });
    expect(write).not.toHaveProperty("initial");
  });
});

describe("versionAgrees", () => {
  const at = new Date("2026-10-11T10:00:00.000Z");

  it("no chart and no token: a first save", () => {
    expect(versionAgrees(null, null)).toBe(true);
  });

  it("a chart and a token: the guarded UPDATE decides", () => {
    expect(versionAgrees({ updatedAt: at }, at)).toBe(true);
    // Even a stale token: the database compares the timestamps.
    expect(versionAgrees({ updatedAt: at }, new Date(0))).toBe(true);
  });

  it("a chart created since the load: conflict", () => {
    expect(versionAgrees({ updatedAt: at }, null)).toBe(false);
  });

  it("a chart reset since the load: conflict", () => {
    expect(versionAgrees(null, at)).toBe(false);
  });
});
