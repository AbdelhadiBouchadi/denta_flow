import "server-only";

import { sql, type Column, type SQL, type Subquery } from "drizzle-orm";

import { db } from "@/database";
import type { Bucket, HourSlot } from "../buckets";
import { MAX_SLICES, OTHERS_KEY } from "../constants";

/**
 * How a row is counted into a TypeScript-built bucket (prompts/30,
 * decision 4). The bucket starts — clinic-midnight instants drawn by
 * `buildBuckets` — travel as ONE array parameter, and Postgres's
 * `width_bucket(value, thresholds[])` returns the 1-based index of the
 * bucket the value falls in. No truncation to a day, no time-zone
 * conversion, no «today» computed by the database: the clinic's calendar
 * exists only in TypeScript. The WHERE clause bounds rows to `[first.start, last.end)`
 * through the shared range predicates, so every index is in 1 … n.
 *
 * Every query groups by the ordinal `1`: the select list and a GROUP BY
 * expression would carry the array as two different parameters, which
 * Postgres treats as two different expressions.
 */

/** A Postgres array literal, sent as ONE text parameter and cast. */
const arrayParam = (values: readonly (string | number)[], type: string) =>
  sql`${`{${values.join(",")}}`}::${sql.raw(type)}`;

/** The 1-based index of the bucket `value` (a timestamptz) falls in. */
export const bucketIndex = (value: Column | SQL, buckets: readonly Bucket[]) =>
  sql<number>`width_bucket(${value}, ${arrayParam(
    buckets.map((bucket) => bucket.start.toISOString()),
    "timestamptz[]",
  )})`;

/**
 * The CLASS of the slot `value` falls in — `classes[width_bucket(...)]`. The
 * slots are the clinic's wall-clock hours (or days), with their weekday and
 * hour already read in TypeScript (`buildHourSlots`); Postgres only finds
 * which slot an instant belongs to. Slot starts travel as epoch seconds — an
 * instant, zone-free, and a third of an ISO string's size over a year of
 * hourly slots.
 */
export const slotClassOf = (
  value: Column | SQL,
  slots: readonly Pick<HourSlot, "start">[],
  classes: readonly number[],
) =>
  sql<number>`(${arrayParam(classes, "int[]")})[width_bucket(EXTRACT(EPOCH FROM ${value})::float8, ${arrayParam(
    slots.map((slot) => slot.start.getTime() / 1000),
    "float8[]",
  )})]`;

/** Rows grouped by bucket index, placed back on the full bucket list. */
export const byBucket = <TRow extends { idx: number }>(
  rows: readonly TRow[],
) => {
  const map = new Map(rows.map((row) => [row.idx, row]));
  return (position: number) => map.get(position + 1);
};

// ── «Autres» ────────────────────────────────────────────────────────────────

/** A grouped subquery with a key, the sliced value, and a count. */
type GroupedSubquery = Subquery & {
  key: SQL.Aliased<string>;
  value: SQL.Aliased<number>;
  n: SQL.Aliased<number>;
};

/**
 * At most MAX_SLICES slices per donut (decision 9): when there are more
 * groups, the largest MAX_SLICES − 1 keep their key and the rest are summed
 * into `OTHERS_KEY` — by Postgres, with window functions, never in
 * JavaScript. Ties break on the key, so the fold is stable.
 */
export const foldIntoOthers = (grouped: GroupedSubquery) => {
  const ranked = db
    .select({
      key: grouped.key,
      value: grouped.value,
      n: grouped.n,
      rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${grouped.value} DESC, ${grouped.key})`.as(
        "rank",
      ),
      groups: sql<number>`COUNT(*) OVER ()`.as("groups"),
    })
    .from(grouped)
    .as("ranked");

  return db
    .select({
      key: sql<string>`CASE WHEN ${ranked.groups} <= ${MAX_SLICES} OR ${ranked.rank} < ${MAX_SLICES} THEN ${ranked.key} ELSE ${OTHERS_KEY} END`,
      value: sql<number>`SUM(${ranked.value})::int`,
      n: sql<number>`SUM(${ranked.n})::int`,
    })
    .from(ranked)
    .groupBy(sql`1`)
    .orderBy(sql`2 DESC`, sql`1`);
};
