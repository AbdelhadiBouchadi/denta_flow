import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addCalendarDays,
  clinicInstant,
  startOfNextClinicDay,
  toClinicDate,
} from "@/lib/time";
import {
  bucketLabels,
  buildBuckets,
  buildDaySlots,
  buildHourSlots,
  granularityFor,
} from "./buckets";
import { Granularity } from "./types";

const HOUR_MS = 3_600_000;

/** The 2026 clinic days that are not 24 h long — found from tzdata, not assumed. */
const clockChangeDays = () => {
  const found: string[] = [];
  for (
    let day = "2026-01-01";
    day <= "2026-12-31";
    day = addCalendarDays(day, 1)
  ) {
    const length =
      startOfNextClinicDay(day).getTime() - clinicInstant(day).getTime();
    if (length !== 24 * HOUR_MS) found.push(day);
  }
  return found;
};

/**
 * Node re-reads `process.env.TZ` on assignment: the same assertions run once
 * per server zone. A leaked system zone shifts a boundary in one of them.
 */
const SERVER_ZONES = ["UTC", "Asia/Tokyo"] as const;

for (const zone of SERVER_ZONES) {
  describe(`buckets, TZ=${zone}`, () => {
    let previous: string | undefined;
    beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = zone;
    });
    afterAll(() => {
      process.env.TZ = previous;
    });

    it("really runs in the zone", () => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    });

    it("picks the granularity at the thresholds", () => {
      const period = (days: number) => ({
        from: "2026-01-01",
        to: addCalendarDays("2026-01-01", days - 1),
      });
      expect(granularityFor(period(1))).toBe(Granularity.Day);
      expect(granularityFor(period(31))).toBe(Granularity.Day);
      expect(granularityFor(period(32))).toBe(Granularity.Week);
      expect(granularityFor(period(120))).toBe(Granularity.Week);
      expect(granularityFor(period(121))).toBe(Granularity.Month);
      expect(granularityFor(period(731))).toBe(Granularity.Month);
    });

    it("one bucket per day for a month", () => {
      const buckets = buildBuckets({ from: "2026-10-01", to: "2026-10-31" });
      expect(buckets).toHaveLength(31);
      expect(buckets[0]).toMatchObject({
        key: "2026-10-01",
        from: "2026-10-01",
        to: "2026-10-01",
        start: clinicInstant("2026-10-01"),
        end: startOfNextClinicDay("2026-10-01"),
      });
    });

    it("weeks run Monday to Sunday, clipped to the period", () => {
      // 2026-07-16 is a Thursday; 2026-10-13 a Tuesday.
      const buckets = buildBuckets({ from: "2026-07-16", to: "2026-10-13" });
      expect(buckets[0]).toMatchObject({
        from: "2026-07-16",
        to: "2026-07-19",
      });
      expect(buckets[1]).toMatchObject({
        from: "2026-07-20",
        to: "2026-07-26",
      });
      expect(buckets.at(-1)).toMatchObject({
        from: "2026-10-12",
        to: "2026-10-13",
      });
      for (const bucket of buckets.slice(1)) {
        expect(new Date(`${bucket.from}T12:00:00Z`).getUTCDay()).toBe(1);
      }
    });

    it("months are clipped to a custom range", () => {
      const buckets = buildBuckets({ from: "2025-10-15", to: "2026-10-13" });
      expect(buckets).toHaveLength(13);
      expect(buckets[0]).toMatchObject({
        key: "2025-10",
        from: "2025-10-15",
        to: "2025-10-31",
      });
      expect(buckets.at(-1)).toMatchObject({
        key: "2026-10",
        from: "2026-10-01",
        to: "2026-10-13",
      });
    });

    it("buckets are contiguous: no gap, no overlap, the whole period", () => {
      for (const period of [
        { from: "2026-10-01", to: "2026-10-31" },
        { from: "2026-07-16", to: "2026-10-13" },
        { from: "2024-10-14", to: "2026-10-13" },
      ]) {
        const buckets = buildBuckets(period);
        expect(buckets[0].start).toEqual(clinicInstant(period.from));
        expect(buckets.at(-1)!.end).toEqual(startOfNextClinicDay(period.to));
        for (let i = 1; i < buckets.length; i++) {
          expect(buckets[i].start).toEqual(buckets[i - 1].end);
          expect(buckets[i].from).toBe(addCalendarDays(buckets[i - 1].to, 1));
        }
        expect(buckets.length).toBeLessThanOrEqual(120);
      }
    });

    it("a clock-change month keeps clinic-midnight boundaries", () => {
      const changes = clockChangeDays();
      // Morocco leaves and re-enters UTC+1 around Ramadan every year.
      expect(changes.length).toBeGreaterThanOrEqual(2);
      const month = changes[0].slice(0, 7);
      const buckets = buildBuckets({
        from: `${month}-01`,
        to: addCalendarDays(`${month}-01`, 27),
      });
      for (const bucket of buckets) {
        expect(toClinicDate(bucket.start)).toBe(bucket.from);
        expect(bucket.start).toEqual(clinicInstant(bucket.from));
      }
      const changeBucket = buckets.find(
        (bucket) => bucket.from === changes[0],
      )!;
      expect(
        changeBucket.end.getTime() - changeBucket.start.getTime(),
      ).not.toBe(24 * HOUR_MS);
    });

    it("hour slots read the wall clock across a clock change", () => {
      const [change] = clockChangeDays();
      const slots = buildHourSlots({ from: change, to: change });
      const length =
        (startOfNextClinicDay(change).getTime() -
          clinicInstant(change).getTime()) /
        HOUR_MS;
      expect(slots).toHaveLength(length);
      expect(slots[0].hour).toBe(0);
      expect(slots.at(-1)!.hour).toBe(23);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].start.getTime()).toBeGreaterThan(
          slots[i - 1].start.getTime(),
        );
      }
    });

    it("hour slots on an ordinary Monday", () => {
      const slots = buildHourSlots({ from: "2026-10-12", to: "2026-10-12" });
      expect(slots).toHaveLength(24);
      expect(slots[10]).toMatchObject({ weekdayIndex: 0, hour: 10 });
      expect(slots[10].start).toEqual(clinicInstant("2026-10-12", "10:00"));
    });

    it("day slots are Monday-first", () => {
      const slots = buildDaySlots({ from: "2026-10-11", to: "2026-10-12" });
      expect(slots.map((slot) => slot.weekdayIndex)).toEqual([6, 0]);
    });

    it("labels are French and zone-independent", () => {
      expect(bucketLabels(Granularity.Day, "2026-10-08", "2026-10-08")).toEqual(
        {
          label: "8 oct.",
          longLabel: "jeudi 8 octobre 2026",
        },
      );
      expect(
        bucketLabels(Granularity.Week, "2026-10-05", "2026-10-11"),
      ).toEqual({
        label: "5 oct.",
        longLabel: "Semaine du 5 octobre au 11 octobre 2026",
      });
      expect(
        bucketLabels(Granularity.Month, "2026-08-01", "2026-08-31"),
      ).toEqual({ label: "août 26", longLabel: "août 2026" });
    });
  });
}
