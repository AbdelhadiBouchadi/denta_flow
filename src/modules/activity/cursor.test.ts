import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "./cursor";

describe("activity cursor", () => {
  const cursor = { at: "2026-10-11T08:15:30.123456", id: "V1StGXR8_Z5jdHi6B-myT" };

  it("round-trips, microseconds included", () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("keeps all six fractional digits — a Date would round them away", () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).toBe("2026-10-11T08:15:30.123456|V1StGXR8_Z5jdHi6B-myT");
    expect(new Date(cursor.at).toISOString()).not.toContain("123456");
  });

  it("keeps two rows of the same instant apart by their id", () => {
    const a = encodeCursor({ ...cursor, id: "aaa" });
    const b = encodeCursor({ ...cursor, id: "bbb" });
    expect(a).not.toBe(b);
    expect(decodeCursor(a)?.at).toBe(decodeCursor(b)?.at);
  });

  it.each([
    "",
    "nonsense",
    "2026-10-11T08:15:30.123|abc", // milliseconds only
    "2026-10-11 08:15:30.123456|abc", // no «T»
    "2026-10-11T08:15:30.123456|", // no id
    "2026-10-11T08:15:30.123456|a b", // outside nanoid's alphabet
    "2026-10-11T08:15:30.123456|abc|def",
    "'; DROP TABLE activity_log; --|abc",
  ])("refuses %j", (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});
