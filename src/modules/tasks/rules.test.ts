import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clinicInstant } from "@/lib/time";
import { TASK_COPY } from "./constants";
import {
  clinicToday,
  compareDoneTasks,
  compareOpenTasks,
  doneWindowStart,
  dueBadge,
  isDueToday,
  isOverdue,
} from "./rules";

// ── The clinic-day boundary, on two process clocks ──────────────────────────
//
// The server may run in any zone. «Today» must be the CLINIC's day: at 23:30
// clinic time a task due that day is still «Aujourd’hui», at 00:30 the next
// day it is overdue — whether the process clock reads UTC or Tokyo (UTC+9,
// already the next calendar day at both instants).

const PROCESS_ZONES = ["UTC", "Asia/Tokyo"] as const;

for (const zone of PROCESS_ZONES) {
  describe(`clinic-day boundary with TZ=${zone}`, () => {
    let previous: string | undefined;
    beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = zone;
    });
    afterAll(() => {
      process.env.TZ = previous;
    });

    // Summer: Morocco is UTC+1. 23:30 clinic = 22:30Z, 00:30 clinic = 23:30Z.
    const lateEvening = new Date("2026-06-20T22:30:00Z");
    const pastMidnight = new Date("2026-06-20T23:30:00Z");
    const task = { dueDate: "2026-06-20", isDone: false };

    it("the process clock really is the zone under test", () => {
      // In Tokyo both instants are already 21 June on the local clock.
      expect(lateEvening.getDate()).toBe(zone === "UTC" ? 20 : 21);
    });

    it("the instants are what the comments say", () => {
      expect(lateEvening).toEqual(clinicInstant("2026-06-20", "23:30"));
      expect(pastMidnight).toEqual(clinicInstant("2026-06-21", "00:30"));
    });

    it("23:30 clinic time: due today, not overdue", () => {
      const today = clinicToday(lateEvening);
      expect(today).toBe("2026-06-20");
      expect(isDueToday(task, today)).toBe(true);
      expect(isOverdue(task, today)).toBe(false);
    });

    it("00:30 clinic time the next day: overdue, no longer today", () => {
      const today = clinicToday(pastMidnight);
      expect(today).toBe("2026-06-21");
      expect(isDueToday(task, today)).toBe(false);
      expect(isOverdue(task, today)).toBe(true);
    });

    it("Ramadan (UTC+0): the boundary moves with the clinic's offset", () => {
      // 2026-03-05 is in Ramadan: 23:30 clinic = 23:30Z, 00:30 clinic = 00:30Z.
      const ramadanTask = { dueDate: "2026-03-05", isDone: false };
      const evening = clinicToday(new Date("2026-03-05T23:30:00Z"));
      const night = clinicToday(new Date("2026-03-06T00:30:00Z"));
      expect(isDueToday(ramadanTask, evening)).toBe(true);
      expect(isOverdue(ramadanTask, night)).toBe(true);
    });

    it("badge labels do not depend on the process clock", () => {
      expect(
        dueBadge({ dueDate: "2026-06-20", isDone: false, isOverdue: true, isDueToday: false }),
      ).toEqual({ tone: "danger", label: "En retard · 20 juin" });
      expect(
        dueBadge({ dueDate: "2026-06-25", isDone: false, isOverdue: false, isDueToday: false }),
      ).toEqual({ tone: "neutral", label: "25 juin 2026" });
    });
  });
}

describe("predicates", () => {
  const today = "2026-06-20";

  it("a done task is never overdue", () => {
    expect(isOverdue({ dueDate: "2026-06-01", isDone: true }, today)).toBe(false);
  });

  it("a task without a date is neither overdue nor due today", () => {
    expect(isOverdue({ dueDate: null, isDone: false }, today)).toBe(false);
    expect(isDueToday({ dueDate: null, isDone: false }, today)).toBe(false);
  });

  it("a future date is neither", () => {
    expect(isOverdue({ dueDate: "2026-06-21", isDone: false }, today)).toBe(false);
    expect(isDueToday({ dueDate: "2026-06-21", isDone: false }, today)).toBe(false);
  });
});

describe("doneWindowStart", () => {
  it("is clinic midnight 30 clinic days before today", () => {
    // 2026-05-21 00:00 in Casablanca (UTC+1) = 2026-05-20T23:00Z.
    expect(doneWindowStart("2026-06-20")).toEqual(new Date("2026-05-20T23:00:00Z"));
  });
});

// ── Order ───────────────────────────────────────────────────────────────────

const day = (iso: string) => new Date(iso);
const open = (
  id: string,
  over: Partial<{ isImportant: boolean; dueDate: string | null; createdAt: Date }> = {},
) => ({
  id,
  isDone: false,
  isImportant: over.isImportant ?? false,
  dueDate: over.dueDate ?? null,
  createdAt: over.createdAt ?? day("2026-06-01T09:00:00Z"),
});

describe("compareOpenTasks", () => {
  const today = "2026-06-20";
  const sort = (rows: ReturnType<typeof open>[]) =>
    [...rows].sort((a, b) => compareOpenTasks(a, b, today)).map((r) => r.id);

  it("important first, then overdue, then dueDate ascending, no date last", () => {
    const rows = [
      open("no-date"),
      open("later", { dueDate: "2026-07-01" }),
      open("today", { dueDate: "2026-06-20" }),
      open("overdue", { dueDate: "2026-06-10" }),
      open("important-no-date", { isImportant: true }),
      open("important-overdue", { isImportant: true, dueDate: "2026-06-15" }),
    ];
    expect(sort(rows)).toEqual([
      "important-overdue",
      "important-no-date",
      "overdue",
      "today",
      "later",
      "no-date",
    ]);
  });

  it("ties on everything else fall to createdAt, then id", () => {
    const rows = [
      open("b", { createdAt: day("2026-06-02T09:00:00Z") }),
      open("c", { createdAt: day("2026-06-01T09:00:00Z") }),
      open("a", { createdAt: day("2026-06-02T09:00:00Z") }),
    ];
    expect(sort(rows)).toEqual(["c", "a", "b"]);
  });

  it("is a total order: any input permutation gives the same result", () => {
    const rows = [
      open("x", { dueDate: "2026-06-22" }),
      open("y", { dueDate: "2026-06-22" }),
      open("z", { isImportant: true }),
    ];
    expect(sort(rows)).toEqual(sort([...rows].reverse()));
  });
});

describe("compareDoneTasks", () => {
  it("most recently completed first, id descending on a tie", () => {
    const rows = [
      { id: "a", completedAt: day("2026-06-10T10:00:00Z") },
      { id: "b", completedAt: day("2026-06-18T10:00:00Z") },
      { id: "c", completedAt: day("2026-06-10T10:00:00Z") },
    ];
    expect([...rows].sort(compareDoneTasks).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("dueBadge", () => {
  it("today is a warning «Aujourd’hui»", () => {
    expect(
      dueBadge({ dueDate: "2026-06-20", isDone: false, isOverdue: false, isDueToday: true }),
    ).toEqual({ tone: "warning", label: TASK_COPY.today });
  });

  it("no date, no badge", () => {
    expect(
      dueBadge({ dueDate: null, isDone: false, isOverdue: false, isDueToday: false }),
    ).toBeNull();
  });

  it("a done task's badge is always neutral, with the full date", () => {
    expect(
      dueBadge({ dueDate: "2026-06-20", isDone: true, isOverdue: false, isDueToday: true }),
    ).toEqual({ tone: "neutral", label: "20 juin 2026" });
  });
});
