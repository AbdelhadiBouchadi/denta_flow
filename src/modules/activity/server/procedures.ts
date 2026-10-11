import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lt, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/database";
import { activityLog, user } from "@/database/schema";
import {
  calendarDateRange,
  clinicNow,
  toClinicDate,
  toClinicWallClock,
  type InstantRange,
} from "@/lib/time";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_VALIDATION_MESSAGES as M,
} from "../constants";
import { CURSOR_AT_FORMAT, decodeCursor, encodeCursor } from "../cursor";
import { activityDayCountsSchema, activityGetDaySchema } from "../schemas";
import { ActivityEntityType } from "../types";
import { isFutureDay, resolveActivityDay, weekDaysOf } from "../week";

/**
 * «Activité du jour». Read-only and append-only: this router has no
 * mutation, and no slice may update or delete a line (prompts/27, decision 5).
 * Rows are written by `logActivity` (./log.ts), in each slice's own batch.
 *
 * Every active staff member reads the whole clinic (AGENTS.md §2) with ONE
 * exception, enforced here in SQL rather than hidden in the UI: payment lines
 * carry amounts, and amounts are the admin's (decision 4). `staffId` is a
 * filter the USER picks — never the caller's id.
 */

interface Viewer {
  role?: string | null;
}

/** The same test as `adminProcedure` (src/trpc/init.ts). */
const isAdmin = (viewer: Viewer) => viewer.role === "admin";

/** What a viewer may read: everything, minus payment lines for non-admins. */
const visibleTo = (viewer: Viewer): SQL | undefined =>
  isAdmin(viewer)
    ? undefined
    : ne(activityLog.entityType, ActivityEntityType.Payment);

const createdWithin = ({ start, end }: InstantRange) =>
  and(gte(activityLog.createdAt, start), lt(activityLog.createdAt, end));

const byStaff = (staffId: string) =>
  staffId ? eq(activityLog.staffId, staffId) : undefined;

const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

/**
 * The clinic day an input names, as a calendar day. Drawn on the clinic's
 * clock here, in TypeScript (src/lib/time.ts): "" is today, a future day is
 * refused — nothing has happened there yet.
 */
const resolveDay = (raw: string) => {
  const today = toClinicDate(clinicNow());
  const day = resolveActivityDay(raw, today);
  if (day === null) throw badRequest(M.invalidDate);
  if (isFutureDay(day, today)) throw badRequest(M.futureDate);
  return { day, today };
};

/**
 * The row's instant as Postgres prints it, microseconds included — the
 * cursor's half that a Date would round away (see ../cursor.ts).
 */
const cursorAt = sql<string>`to_char(${activityLog.createdAt}, ${CURSOR_AT_FORMAT})`;

export const activityRouter = createTRPCRouter({
  /**
   * The timeline of one clinic day, newest first, keyset-paginated on
   * `(createdAt, id)`: a line written while someone pages never shifts the
   * pages after it, as OFFSET would. One extra row is read to know whether
   * a next page exists.
   */
  getDay: protectedProcedure
    .input(activityGetDaySchema)
    .query(async ({ input, ctx }) => {
      const { day } = resolveDay(input.date);

      let after: SQL | undefined;
      if (input.cursor) {
        const cursor = decodeCursor(input.cursor);
        if (!cursor) throw badRequest(M.invalidCursor);
        // Row comparison, in the ORDER BY's own terms: strictly older, or
        // the same instant with a smaller id.
        after = sql`(${activityLog.createdAt}, ${activityLog.id}) < (${cursor.at}::timestamp, ${cursor.id})`;
      }

      const rows = await db
        .select({
          id: activityLog.id,
          createdAt: activityLog.createdAt,
          cursorAt,
          entityType: activityLog.entityType,
          action: activityLog.action,
          summary: activityLog.summary,
          patientId: activityLog.patientId,
          staffName: user.name,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.staffId, user.id))
        .where(
          and(
            createdWithin(calendarDateRange(day, day)),
            visibleTo(ctx.auth.user),
            byStaff(input.staffId),
            after,
          ),
        )
        .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
        .limit(ACTIVITY_PAGE_SIZE + 1);

      const page = rows.slice(0, ACTIVITY_PAGE_SIZE);
      const last = page.at(-1);

      return {
        items: page.map((row) => ({
          id: row.id,
          // "HH:mm" on the clinic's clock, computed once, here — the server
          // render and the hydration print the same text.
          time: toClinicWallClock(row.createdAt),
          // Stored as text; the values of ActivityEntityType.
          entityType: row.entityType as ActivityEntityType,
          action: row.action,
          summary: row.summary,
          patientId: row.patientId,
          staffName: row.staffName,
        })),
        nextCursor:
          rows.length > ACTIVITY_PAGE_SIZE && last
            ? encodeCursor({ at: last.cursorAt, id: last.id })
            : null,
      };
    }),

  /**
   * The week strip: one count per day of the Monday-first clinic week that
   * holds `weekOf`, with the SAME predicate as `getDay` — visibility, staff
   * filter and day bounds — so a day's count is the number of lines it
   * shows. The seven ranges come from TypeScript (a 23- or 25-hour day
   * included) and are counted in one statement with FILTER clauses.
   *
   * `today` travels with the counts: the strip greys out the future against
   * the server's clock, never the browser's.
   */
  getDayCounts: protectedProcedure
    .input(activityDayCountsSchema)
    .query(async ({ input, ctx }) => {
      const { day, today } = resolveDay(input.weekOf);
      const days = weekDaysOf(day);

      const columns = Object.fromEntries(
        days.map((date, index) => [
          `d${index}`,
          sql<number>`(COUNT(*) FILTER (WHERE ${createdWithin(
            calendarDateRange(date, date),
          )}))::int`,
        ]),
      );

      const week = calendarDateRange(days[0], days[6]);
      const [counts] = await db
        .select(columns)
        .from(activityLog)
        .where(
          and(
            createdWithin(week),
            visibleTo(ctx.auth.user),
            byStaff(input.staffId),
          ),
        );

      return {
        today,
        selected: day,
        days: days.map((date, index) => ({
          date,
          count: Number(counts?.[`d${index}`] ?? 0),
          isFuture: isFutureDay(date, today),
        })),
      };
    }),

  /**
   * The staff filter's options: everyone who has a visible line, active or
   * not — a deactivated assistant's past work stays filterable.
   */
  getStaff: protectedProcedure.query(({ ctx }) =>
    db
      .selectDistinct({ id: user.id, name: user.name, isActive: user.isActive })
      .from(activityLog)
      .innerJoin(user, eq(activityLog.staffId, user.id))
      .where(visibleTo(ctx.auth.user))
      .orderBy(asc(user.name), asc(user.id)),
  ),
});
