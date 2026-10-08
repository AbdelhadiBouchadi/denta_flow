import { describe, expect, it, vi } from "vitest";

import { clinicInstant } from "@/lib/time";
import {
  documentNumberPrefix,
  formatDocumentNumber,
  isUniqueViolation,
  nextDocumentNumber,
  NumberUnavailableError,
  withUniqueViolationRetry,
} from "./numbering";
import { DocumentType } from "./types";

const JUNE_2026 = new Date("2026-06-17T10:00:00Z");

/** What @neondatabase/serverless raises, wrapped on `cause` as drizzle does. */
const uniqueViolation = () =>
  new Error("Failed query", {
    cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
  });

describe("document numbers", () => {
  it("starts each type at 0001 for the first document of the year", () => {
    expect(nextDocumentNumber(DocumentType.Invoice, JUNE_2026, [])).toBe(
      "F-2026-0001",
    );
    expect(nextDocumentNumber(DocumentType.Quote, JUNE_2026, [])).toBe(
      "D-2026-0001",
    );
  });

  it("takes the next sequence of its own type and year only", () => {
    const existing = [
      "F-2026-0001",
      "F-2026-0002",
      "D-2026-0007",
      "F-2025-0099",
      null,
    ];
    expect(nextDocumentNumber(DocumentType.Invoice, JUNE_2026, existing)).toBe(
      "F-2026-0003",
    );
    expect(nextDocumentNumber(DocumentType.Quote, JUNE_2026, existing)).toBe(
      "D-2026-0008",
    );
  });

  it("never reissues a number: removed rows still count, gaps stay gaps", () => {
    // 0002 removed long ago and absent; 0003 removed but its row kept.
    expect(
      nextDocumentNumber(DocumentType.Invoice, JUNE_2026, [
        "F-2026-0001",
        "F-2026-0003",
      ]),
    ).toBe("F-2026-0004");
  });

  it("rolls over on the CLINIC's new year, not UTC's", () => {
    // Instants built from the clinic's wall clock, never from a hardcoded
    // offset: Casablanca's offset on 31 December depends on the year's
    // Ramadan (tzdata says UTC+0 for 2026-12-31).
    const lastMinute2026 = clinicInstant("2026-12-31", "23:59");
    const firstMinute2027 = clinicInstant("2027-01-01", "00:00");

    expect(documentNumberPrefix(DocumentType.Invoice, lastMinute2026)).toBe(
      "F-2026",
    );
    expect(
      nextDocumentNumber(DocumentType.Invoice, firstMinute2027, ["F-2026-0042"]),
    ).toBe("F-2027-0001");
  });

  it("reads the year on the clinic clock when it differs from UTC's", () => {
    // 1 January 2026, 00:30 in the clinic while UTC is still in 2025 — the
    // offset that day is whatever tzdata says; only the year is asserted.
    const instant = clinicInstant("2026-01-01", "00:30");
    expect(documentNumberPrefix(DocumentType.Quote, instant)).toBe("D-2026");
  });

  it("pads to four digits and never truncates past 9999", () => {
    expect(formatDocumentNumber("F-2026", 7)).toBe("F-2026-0007");
    expect(formatDocumentNumber("F-2026", 10000)).toBe("F-2026-10000");
    expect(
      nextDocumentNumber(DocumentType.Invoice, JUNE_2026, ["F-2026-9999"]),
    ).toBe("F-2026-10000");
  });
});

describe("withUniqueViolationRetry", () => {
  it("recognises 23505 through drizzle's wrapping", () => {
    expect(isUniqueViolation(uniqueViolation())).toBe(true);
    expect(isUniqueViolation(new Error("other"))).toBe(false);
  });

  it("retries after losing the number to a concurrent insert", async () => {
    const attempt = vi
      .fn<(n: number) => Promise<string>>()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce("F-2026-0002");

    await expect(withUniqueViolationRetry(attempt, 5)).resolves.toBe(
      "F-2026-0002",
    );
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("rethrows any other error at once", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withUniqueViolationRetry(attempt, 5)).rejects.toThrow("boom");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("gives up after a bounded number of attempts", async () => {
    const attempt = vi.fn().mockRejectedValue(uniqueViolation());
    await expect(withUniqueViolationRetry(attempt, 3)).rejects.toBeInstanceOf(
      NumberUnavailableError,
    );
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
