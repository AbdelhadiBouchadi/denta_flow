import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clinicInstant } from "@/lib/time";
import { IMAGING_COPY as COPY } from "./constants";
import {
  flattenGroups,
  groupByDate,
  groupByType,
  neighboursOf,
  toggleCompareSelection,
} from "./gallery";
import { PatientFileKind } from "./types";

const file = (id: string, kind: PatientFileKind, day: string) => ({
  id,
  kind,
  // What the server stores: the clinic-midnight instant of the clinic day.
  takenAt: clinicInstant(day),
});

// ── «Par date», on two process clocks ───────────────────────────────────────
//
// The browser may sit in any zone. «Aujourd’hui» must be the CLINIC's day:
// at 23:30 clinic time an image taken that day is «Aujourd’hui», at 00:30 the
// next day it is «Hier» — whether the process clock reads UTC or Tokyo
// (UTC+9, already the next calendar day at both instants).

for (const zone of ["UTC", "Asia/Tokyo"] as const) {
  describe(`groupByDate with TZ=${zone}`, () => {
    let previous: string | undefined;
    beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = zone;
    });
    afterAll(() => {
      process.env.TZ = previous;
    });

    // Summer: Morocco is UTC+1.
    const lateEvening = clinicInstant("2026-06-20", "23:30");
    const pastMidnight = clinicInstant("2026-06-21", "00:30");

    it("the process clock really is the zone under test", () => {
      expect(lateEvening.getDate()).toBe(zone === "UTC" ? 20 : 21);
    });

    it("23:30 clinic time: that day's images are «Aujourd’hui»", () => {
      const groups = groupByDate(
        [file("a", PatientFileKind.Photo, "2026-06-20"), file("b", PatientFileKind.Photo, "2026-06-19")],
        lateEvening,
      );
      expect(groups.map((group) => group.label)).toEqual([COPY.today, COPY.yesterday]);
    });

    it("00:30 clinic time the next day: the same images are «Hier», then a long date", () => {
      const groups = groupByDate(
        [file("a", PatientFileKind.Photo, "2026-06-20"), file("b", PatientFileKind.Photo, "2026-06-19")],
        pastMidnight,
      );
      expect(groups.map((group) => group.label)).toEqual([COPY.yesterday, "19 juin 2026"]);
    });

    it("an image is grouped on its clinic day, not the process clock's", () => {
      // Clinic midnight of 20 June is 23:00Z on the 19th — still the 20th.
      const groups = groupByDate([file("a", PatientFileKind.Photo, "2026-06-20")], pastMidnight);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe("2026-06-20");
    });
  });
}

describe("groupByDate", () => {
  const now = clinicInstant("2026-10-13", "10:00");

  it("returns no group for no image", () => {
    expect(groupByDate([], now)).toEqual([]);
  });

  it("newest day first, a count per day, kinds in the fixed order then id", () => {
    const groups = groupByDate(
      [
        file("z", PatientFileKind.Photo, "2026-10-12"),
        file("b", PatientFileKind.Periapical, "2026-10-12"),
        file("a", PatientFileKind.Periapical, "2026-10-12"),
        file("p", PatientFileKind.Panoramic, "2026-10-12"),
        file("old", PatientFileKind.Other, "2026-01-05"),
        file("new", PatientFileKind.Other, "2026-10-13"),
      ],
      now,
    );
    expect(groups.map((group) => group.label)).toEqual([
      COPY.today,
      COPY.yesterday,
      "5 janvier 2026",
    ]);
    expect(groups[1].files.map((f) => f.id)).toEqual(["p", "a", "b", "z"]);
    expect(groups.map((group) => group.files.length)).toEqual([1, 4, 1]);
  });
});

describe("groupByType", () => {
  it("fixed order, newest first inside a kind, empty kinds hidden", () => {
    const groups = groupByType([
      file("photo-old", PatientFileKind.Photo, "2026-01-01"),
      file("retro", PatientFileKind.Periapical, "2026-05-01"),
      file("photo-new", PatientFileKind.Photo, "2026-09-01"),
      file("pano", PatientFileKind.Panoramic, "2025-12-01"),
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Panoramiques",
      "Rétro-alvéolaires",
      "Photos",
    ]);
    expect(groups[2].files.map((f) => f.id)).toEqual(["photo-new", "photo-old"]);
  });

  it("returns no group for no image", () => {
    expect(groupByType([])).toEqual([]);
  });

  it("flattens in group order — the order the viewer walks", () => {
    const groups = groupByType([
      file("photo", PatientFileKind.Photo, "2026-01-01"),
      file("pano", PatientFileKind.Panoramic, "2025-12-01"),
    ]);
    expect(flattenGroups(groups).map((f) => f.id)).toEqual(["pano", "photo"]);
  });
});

describe("toggleCompareSelection", () => {
  it("selects up to two images", () => {
    const one = toggleCompareSelection([], "a");
    const two = toggleCompareSelection(one.selected, "b");
    expect(two).toEqual({ selected: ["a", "b"], refused: false });
  });

  it("deselects a selected image", () => {
    expect(toggleCompareSelection(["a", "b"], "a")).toEqual({
      selected: ["b"],
      refused: false,
    });
  });

  it("refuses a third image and keeps the two", () => {
    expect(toggleCompareSelection(["a", "b"], "c")).toEqual({
      selected: ["a", "b"],
      refused: true,
    });
  });
});

describe("neighboursOf", () => {
  const ids = ["a", "b", "c"];

  it("first: no previous", () => {
    expect(neighboursOf(ids, "a")).toEqual({ index: 0, previousId: null, nextId: "b" });
  });

  it("middle: both sides", () => {
    expect(neighboursOf(ids, "b")).toEqual({ index: 1, previousId: "a", nextId: "c" });
  });

  it("last: no next", () => {
    expect(neighboursOf(ids, "c")).toEqual({ index: 2, previousId: "b", nextId: null });
  });

  it("single image: neither side", () => {
    expect(neighboursOf(["a"], "a")).toEqual({ index: 0, previousId: null, nextId: null });
  });

  it("an id outside the set (removed or filtered out): index -1", () => {
    expect(neighboursOf(ids, "x").index).toBe(-1);
    expect(neighboursOf(ids, null).index).toBe(-1);
  });
});
