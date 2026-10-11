/**
 * The keyset cursor of `activity.getDay`: the last row's `(createdAt, id)`.
 *
 * `created_at` is a Postgres `timestamp` — MICROsecond precision — while a
 * JS Date holds milliseconds. A cursor built from a Date would round the
 * instant away, and two rows written in the same millisecond (one `db.batch`
 * stamps every row with the same `now()`) would be skipped or repeated at a
 * page edge. So the instant travels as the text Postgres printed, all six
 * fractional digits, and goes back into SQL as `::timestamp` — never through
 * a Date.
 *
 * Format: `2026-10-11T08:15:30.123456|<id>`. «|» is outside nanoid's
 * alphabet, and the instant has a fixed width, so the split is unambiguous.
 * Free of `db` so Vitest covers it.
 */

export interface ActivityCursor {
  /** `YYYY-MM-DDTHH:MM:SS.ffffff`, UTC wall time as stored. */
  at: string;
  id: string;
}

/** The text the read selects next to each row (see `cursorAt` in procedures). */
export const CURSOR_AT_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US';

const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6})\|([A-Za-z0-9_-]{1,64})$/;

export const encodeCursor = ({ at, id }: ActivityCursor) => `${at}|${id}`;

/** The cursor back, or `null` for anything this module did not encode. */
export const decodeCursor = (cursor: string): ActivityCursor | null => {
  const match = CURSOR_PATTERN.exec(cursor);
  return match ? { at: match[1], id: match[2] } : null;
};
