import { describe, expect, it } from "vitest";

import { archivedPatientBlocksWrite } from "./archived-guard";

describe("archivedPatientBlocksWrite", () => {
  it("blocks creating an acte for an archived patient", () => {
    expect(
      archivedPatientBlocksWrite({
        targetIsArchived: true,
        targetPatientId: "archived",
      }),
    ).toBe(true);
  });

  it("allows correcting an archived patient's existing acte", () => {
    expect(
      archivedPatientBlocksWrite({
        targetIsArchived: true,
        targetPatientId: "archived",
        existingPatientId: "archived",
      }),
    ).toBe(false);
  });

  it("blocks moving an acte onto an archived patient", () => {
    expect(
      archivedPatientBlocksWrite({
        targetIsArchived: true,
        targetPatientId: "archived",
        existingPatientId: "active",
      }),
    ).toBe(true);
  });

  it("never blocks an active patient", () => {
    expect(
      archivedPatientBlocksWrite({
        targetIsArchived: false,
        targetPatientId: "active",
      }),
    ).toBe(false);
    expect(
      archivedPatientBlocksWrite({
        targetIsArchived: false,
        targetPatientId: "active",
        existingPatientId: "other",
      }),
    ).toBe(false);
  });
});
