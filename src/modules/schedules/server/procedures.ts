import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray } from "drizzle-orm";

import { PRACTITIONER_ROLES } from "@/constants";
import { db } from "@/database";
import {
  practitionerSchedules,
  scheduleExceptions,
  user,
} from "@/database/schema";
import { toPgTime } from "@/lib/time";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { isWeekConfigured, SCHEDULE_SERVER_ERRORS } from "../constants";
import { exceptionToInstants, instantsToExceptionPeriod } from "../exceptions";
import {
  exceptionFormSchema,
  exceptionIdSchema,
  exceptionUpdateSchema,
  getExceptionsSchema,
  getWeekSchema,
  weekFormSchema,
} from "../schemas";
import { groupWeek } from "../week";

/**
 * Weekly hours and closures. They bound the agenda grid and drive its
 * out-of-hours warning (branch 18). They never block a booking — clinics run
 * overtime, and the software must not pretend otherwise.
 *
 * Reads are `protectedProcedure` with no staff scoping (AGENTS.md §2); every
 * write is `adminProcedure`.
 */

/** The one SQL reading of «practitioner»: active, with a practitioner role. */
const isActivePractitioner = and(
  eq(user.isActive, true),
  inArray(user.role, [...PRACTITIONER_ROLES]),
);

const isPractitionerRole = (role: string) =>
  (PRACTITIONER_ROLES as readonly string[]).includes(role);

const practitionerNotFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: SCHEDULE_SERVER_ERRORS.practitionerNotFound,
  });

const exceptionNotFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: SCHEDULE_SERVER_ERRORS.exceptionNotFound,
  });

/**
 * Hours and leave are entered for active practitioners only. `keepId` lets an
 * edit keep the practitioner a closure already names, even if that person has
 * since been deactivated.
 */
const assertPractitioner = async (id: string, keepId?: string | null) => {
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(eq(user.id, id), keepId === id ? undefined : isActivePractitioner),
    )
    .limit(1);

  if (!found) throw practitionerNotFound();
};

export const schedulesRouter = createTRPCRouter({
  /**
   * Who the selector offers: active practitioners only, by name. Branch 16's
   * appointment form and branch 18's agenda filter read the same list.
   */
  getPractitioners: protectedProcedure.query(async () => {
    const items = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        color: user.color,
      })
      .from(user)
      .where(isActivePractitioner)
      .orderBy(asc(user.name), asc(user.id));

    return { items, total: items.length, totalPages: 1 };
  }),

  /**
   * One practitioner's week, seven days lundi → dimanche, times as "HH:mm".
   * With no `practitionerId`: the caller if they are a practitioner, else the
   * first active one, else none. `isConfigured` false is «unconfigured» —
   * see `isWeekConfigured` in constants.ts.
   */
  getWeek: protectedProcedure
    .input(getWeekSchema)
    .query(async ({ input, ctx }) => {
      let practitionerId = input.practitionerId ?? null;

      if (!practitionerId) {
        const caller = ctx.auth.user;
        if (caller.isActive && isPractitionerRole(caller.role)) {
          practitionerId = caller.id;
        } else {
          const [first] = await db
            .select({ id: user.id })
            .from(user)
            .where(isActivePractitioner)
            .orderBy(asc(user.name), asc(user.id))
            .limit(1);
          practitionerId = first?.id ?? null;
        }
      }

      const rows = practitionerId
        ? await db
            .select({
              weekday: practitionerSchedules.weekday,
              startTime: practitionerSchedules.startTime,
              endTime: practitionerSchedules.endTime,
            })
            .from(practitionerSchedules)
            .where(
              and(
                eq(practitionerSchedules.practitionerId, practitionerId),
                eq(practitionerSchedules.isActive, true),
              ),
            )
        : [];

      const days = groupWeek(rows);
      return { practitionerId, days, isConfigured: isWeekConfigured(days) };
    }),

  /**
   * Replaces the whole week atomically. The Neon HTTP driver has no
   * interactive transactions (`db.transaction` throws on neon-http), but
   * drizzle's `db.batch` sends every statement in ONE Neon HTTP transaction —
   * verified against drizzle-orm 0.45 (`NeonHttpSession.batch` →
   * `client.transaction(queries)`). The delete and the insert commit together
   * or not at all. An invalid week is refused by the schema before any
   * statement runs, so the old week stays intact.
   */
  setWeek: adminProcedure.input(weekFormSchema).mutation(async ({ input }) => {
    await assertPractitioner(input.practitionerId);

    const deleteWeek = db
      .delete(practitionerSchedules)
      .where(eq(practitionerSchedules.practitionerId, input.practitionerId));

    if (input.ranges.length === 0) {
      await deleteWeek;
    } else {
      await db.batch([
        deleteWeek,
        db.insert(practitionerSchedules).values(
          input.ranges.map((range) => ({
            practitionerId: input.practitionerId,
            weekday: range.weekday,
            startTime: toPgTime(range.startTime),
            endTime: toPgTime(range.endTime),
          })),
        ),
      ]);
    }

    return { practitionerId: input.practitionerId, count: input.ranges.length };
  }),

  /**
   * Upcoming (not yet ended) by default; `includePast` adds the rest.
   * Each row carries its `period` — calendar days and wall-clock times,
   * resolved in the clinic timezone — for the list and the edit form.
   */
  getExceptions: protectedProcedure
    .input(getExceptionsSchema)
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: scheduleExceptions.id,
          practitionerId: scheduleExceptions.practitionerId,
          practitionerName: user.name,
          startsAt: scheduleExceptions.startsAt,
          endsAt: scheduleExceptions.endsAt,
          reason: scheduleExceptions.reason,
        })
        .from(scheduleExceptions)
        .leftJoin(user, eq(user.id, scheduleExceptions.practitionerId))
        .where(
          input.includePast
            ? undefined
            : gt(scheduleExceptions.endsAt, new Date()),
        )
        .orderBy(asc(scheduleExceptions.startsAt), asc(scheduleExceptions.id));

      const now = Date.now();
      const items = rows.map((row) => ({
        ...row,
        period: instantsToExceptionPeriod(row),
        isPast: row.endsAt.getTime() <= now,
      }));

      return { items, total: items.length, totalPages: 1 };
    }),

  createException: adminProcedure
    .input(exceptionFormSchema)
    .mutation(async ({ input }) => {
      if (input.practitionerId) await assertPractitioner(input.practitionerId);

      const [created] = await db
        .insert(scheduleExceptions)
        .values({
          practitionerId: input.practitionerId,
          ...exceptionToInstants(input),
          reason: input.reason,
        })
        .returning();
      return created;
    }),

  updateException: adminProcedure
    .input(exceptionUpdateSchema)
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select({ practitionerId: scheduleExceptions.practitionerId })
        .from(scheduleExceptions)
        .where(eq(scheduleExceptions.id, input.id));

      if (!existing) throw exceptionNotFound();
      if (input.practitionerId) {
        await assertPractitioner(input.practitionerId, existing.practitionerId);
      }

      const [updated] = await db
        .update(scheduleExceptions)
        .set({
          practitionerId: input.practitionerId,
          ...exceptionToInstants(input),
          reason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(scheduleExceptions.id, input.id))
        .returning();

      if (!updated) throw exceptionNotFound();
      return updated;
    }),

  /** A real delete: a closure is configuration, not history. */
  removeException: adminProcedure
    .input(exceptionIdSchema)
    .mutation(async ({ input }) => {
      const [removed] = await db
        .delete(scheduleExceptions)
        .where(eq(scheduleExceptions.id, input.id))
        .returning();

      if (!removed) throw exceptionNotFound();
      return removed;
    }),
});
