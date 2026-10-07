import { TRPCError } from "@trpc/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { APPOINTMENT_SERVER_ERRORS } from "../constants";
import { AppointmentStatus } from "../types";
import {
  changeStatus,
  guardedWrite,
  versionMatches,
  type AppointmentStatusStore,
} from "./concurrency";

/**
 * Vitest stays pure logic (AGENTS.md §3): no database. This store models the
 * three Postgres facts the guard depends on —
 *   1. `updated_at` holds MICROseconds (`DEFAULT now()`),
 *   2. the driver hands the client a Date, truncated to MILLIseconds,
 *   3. `UPDATE … WHERE <precondition> RETURNING *` is atomic per row and
 *      returns nothing when the precondition no longer holds.
 * The SQL the procedure really sends is pinned by the rendering test below.
 */
interface StoredRow {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  updatedAtMicros: number; // µs since epoch — ~1.8e15, a safe integer
}

const createStore = () => {
  const rows = new Map<string, StoredRow>();
  // A clock that always moves, as two real saves are never at the same µs.
  // Starts after every seeded row: a save is always later than the load.
  let clockMs = Date.UTC(2026, 9, 7, 10, 0, 0);
  const tick = () => (clockMs += 7) * 1000;
  // Lets two "concurrent" calls both finish their read before either writes.
  const yieldToOthers = () => new Promise((resolve) => setTimeout(resolve, 0));

  const view = (row: StoredRow) => ({
    id: row.id,
    status: row.status,
    notes: row.notes,
    updatedAt: new Date(Math.floor(row.updatedAtMicros / 1000)),
  });

  return {
    insert: (row: StoredRow) => rows.set(row.id, { ...row }),
    remove: (id: string) => rows.delete(id),
    raw: (id: string) => rows.get(id),
    /** What `getOne` / `getMany` hand the client: a millisecond Date. */
    read: (id: string) => {
      const row = rows.get(id);
      return row ? view(row) : undefined;
    },
    exists: async (id: string) => rows.has(id),

    /** UPDATE … WHERE id = :id AND date_trunc('milliseconds', updated_at) = :expected */
    updateIfVersion: async (
      id: string,
      expected: Date,
      patch: { notes: string },
    ) => {
      const row = rows.get(id);
      if (
        !row ||
        Math.floor(row.updatedAtMicros / 1000) !== expected.getTime()
      ) {
        return undefined;
      }
      Object.assign(row, patch, { updatedAtMicros: tick() });
      return view(row);
    },

    statusStore: {
      readStatus: async (id) => {
        const status = rows.get(id)?.status ?? null;
        await yieldToOthers();
        return status;
      },
      /** UPDATE … WHERE id = :id AND status = :from */
      writeStatusIf: async (id, from, to) => {
        const row = rows.get(id);
        if (!row || row.status !== from) return undefined;
        row.status = to;
        row.updatedAtMicros = tick();
        return view(row);
      },
      exists: async (id) => rows.has(id),
    } satisfies AppointmentStatusStore<ReturnType<typeof view>>,
  };
};

/** `appointments.update`'s write step, exactly as the procedure composes it. */
const saveNotes = (
  store: ReturnType<typeof createStore>,
  id: string,
  expectedUpdatedAt: Date,
  notes: string,
) =>
  guardedWrite({
    write: () => store.updateIfVersion(id, expectedUpdatedAt, { notes }),
    exists: () => store.exists(id),
    conflictMessage: APPOINTMENT_SERVER_ERRORS.appointmentChangedMeanwhile,
  });

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as TRPCError;
  }
  throw new Error("expected a rejection");
};

/** A seeded row: `updated_at` straight from `now()`, sub-millisecond digits. */
const seeded = (id: string, status = AppointmentStatus.Planned): StoredRow => ({
  id,
  status,
  notes: null,
  updatedAtMicros: 1_791_363_600_123_456, // …:00.123456
});

describe("update — the version token", () => {
  it("saves when the token matches", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const loaded = store.read("a1")!;

    const saved = await saveNotes(
      store,
      "a1",
      loaded.updatedAt,
      "Apporter la radio",
    );

    expect(saved.notes).toBe("Apporter la radio");
    expect(saved.updatedAt.getTime()).toBeGreaterThan(
      loaded.updatedAt.getTime(),
    );
  });

  it("rejects a stale token with CONFLICT and writes nothing", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const tabA = store.read("a1")!;
    const tabB = store.read("a1")!;

    // Tab B saves first; tab A still holds the version it loaded.
    await saveNotes(store, "a1", tabB.updatedAt, "Version B");
    const error = await rejection(
      saveNotes(store, "a1", tabA.updatedAt, "Version A"),
    );

    expect(error).toBeInstanceOf(TRPCError);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe(
      "Ce rendez-vous a été modifié entre-temps. Rechargez-le avant de réessayer.",
    );
    expect(store.read("a1")!.notes).toBe("Version B");
  });

  it("answers NOT_FOUND, not CONFLICT, for a row deleted meanwhile", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const loaded = store.read("a1")!;
    store.remove("a1");

    const error = await rejection(
      saveNotes(store, "a1", loaded.updatedAt, "x"),
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe(APPOINTMENT_SERVER_ERRORS.notFound);
  });

  it("saves the first edit of a never-updated row (microsecond updated_at)", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const loaded = store.read("a1")!;

    // The token lost the µs: comparing the raw column would never match…
    expect(store.raw("a1")!.updatedAtMicros).not.toBe(
      loaded.updatedAt.getTime() * 1000,
    );
    // …so the guard compares the column truncated to ms, and the save lands.
    await expect(
      saveNotes(store, "a1", loaded.updatedAt, "ok"),
    ).resolves.toMatchObject({ notes: "ok" });
  });

  it("a token is single-use: replaying it after a save is a CONFLICT", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const loaded = store.read("a1")!;

    await saveNotes(store, "a1", loaded.updatedAt, "1");
    const error = await rejection(
      saveNotes(store, "a1", loaded.updatedAt, "2"),
    );
    expect(error.code).toBe("CONFLICT");
  });
});

describe("updateStatus — the status guard", () => {
  it("two concurrent moves from `planned`: exactly one succeeds", async () => {
    const store = createStore();
    store.insert(seeded("a1"));

    const results = await Promise.allSettled([
      changeStatus(store.statusStore, "a1", AppointmentStatus.Confirmed),
      changeStatus(store.statusStore, "a1", AppointmentStatus.Canceled),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe("CONFLICT");
    expect(rejected[0].reason.message).toBe(
      APPOINTMENT_SERVER_ERRORS.statusChangedMeanwhile,
    );
    // The winner's status is the one stored.
    expect([AppointmentStatus.Confirmed, AppointmentStatus.Canceled]).toContain(
      store.read("a1")!.status,
    );
  });

  it("sets updatedAt, so an editor holding the old version is now stale", async () => {
    const store = createStore();
    store.insert(seeded("a1"));
    const editor = store.read("a1")!;

    await changeStatus(store.statusStore, "a1", AppointmentStatus.Confirmed);

    const error = await rejection(
      saveNotes(store, "a1", editor.updatedAt, "x"),
    );
    expect(error.code).toBe("CONFLICT");
  });

  it("is NOT_FOUND for a missing row and BAD_REQUEST for an illegal move", async () => {
    const store = createStore();
    store.insert(seeded("done", AppointmentStatus.Completed));

    expect(
      (
        await rejection(
          changeStatus(store.statusStore, "nope", AppointmentStatus.Confirmed),
        )
      ).code,
    ).toBe("NOT_FOUND");
    expect(
      (
        await rejection(
          changeStatus(store.statusStore, "done", AppointmentStatus.Planned),
        )
      ).code,
    ).toBe("BAD_REQUEST");
  });
});

describe("versionMatches — the SQL actually sent", () => {
  it("truncates the column to milliseconds and casts the token to `timestamp`", () => {
    const token = new Date("2026-10-07T09:00:00.123Z");
    const { sql, params } = new PgDialect().sqlToQuery(versionMatches(token));

    expect(sql).toBe(
      `date_trunc('milliseconds', "appointments"."updated_at") = $1::timestamp`,
    );
    // The column has no time zone: the cast drops the «Z» and keeps the UTC
    // wall time drizzle wrote.
    expect(params).toEqual(["2026-10-07T09:00:00.123Z"]);
  });
});
