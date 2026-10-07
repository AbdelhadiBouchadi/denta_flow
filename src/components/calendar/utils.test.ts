import { describe, expect, it } from "vitest";

import { assignOverlapLanes } from "./utils";

/** "10:15" → a Date on one fixed day; only the ordering matters here. */
const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 2, 12, hours, minutes);
};
const span = (start: string, end: string) => ({
  start: at(start),
  end: at(end),
});

describe("assignOverlapLanes", () => {
  it("gives a lone event the whole column", () => {
    expect(assignOverlapLanes([span("09:00", "10:00")])).toEqual([
      { lane: 0, lanes: 1 },
    ]);
  });

  it("splits three overlapping events into three equal lanes", () => {
    expect(
      assignOverlapLanes([
        span("10:00", "11:00"),
        span("10:15", "10:45"),
        span("10:30", "11:00"),
      ]),
    ).toEqual([
      { lane: 0, lanes: 3 },
      { lane: 1, lanes: 3 },
      { lane: 2, lanes: 3 },
    ]);
  });

  it("does not treat touching events as overlapping", () => {
    expect(
      assignOverlapLanes([span("10:00", "10:30"), span("10:30", "11:00")]),
    ).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("reuses a freed lane inside a chained cluster", () => {
    // A overlaps B, B overlaps C, A and C do not: two lanes, C takes A's.
    expect(
      assignOverlapLanes([
        span("09:00", "10:00"),
        span("09:30", "10:30"),
        span("10:00", "11:00"),
      ]),
    ).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
    ]);
  });

  it("sizes each cluster on its own", () => {
    expect(
      assignOverlapLanes([
        span("09:00", "10:00"),
        span("09:00", "09:30"),
        span("14:00", "15:00"),
      ]),
    ).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 1 },
    ]);
  });
});
