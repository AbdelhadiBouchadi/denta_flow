import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/database";
import { tasks, user } from "@/database/schema";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { DONE_LIMIT, TASK_SERVER_ERRORS as E } from "../constants";
import { clinicToday, doneWindowStart } from "../rules";
import {
  taskIdSchema,
  taskInsertSchema,
  taskSetDoneSchema,
  taskUpdateSchema,
} from "../schemas";

/**
 * `/taches` — the clinic's shared to-do list. Tasks belong to the clinic,
 * not to a person (prompts/23, decision 1): no read is scoped to the caller,
 * every active staff member reads, creates, edits and completes every task.
 */

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: E.notFound });

/**
 * The flags are computed by Postgres against `today`, a clinic calendar day
 * drawn in TypeScript and passed as a parameter — never `CURRENT_DATE`, which
 * is the database's UTC day and wrong for an hour of every Moroccan night.
 * COALESCE: `NULL < date` is NULL, and NULL sorts FIRST under DESC.
 */
const overdueSql = (today: string) =>
  sql<boolean>`(NOT ${tasks.isDone} AND COALESCE(${tasks.dueDate} < ${today}::date, false))`;

const dueTodaySql = (today: string) =>
  sql<boolean>`COALESCE(${tasks.dueDate} = ${today}::date, false)`;

/** A fresh builder each call — the open and done reads each need their own. */
const selectTasks = (today: string) =>
  db
    .select({
      id: tasks.id,
      content: tasks.content,
      dueDate: tasks.dueDate,
      isImportant: tasks.isImportant,
      isDone: tasks.isDone,
      completedAt: tasks.completedAt,
      createdByStaffId: tasks.createdByStaffId,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      isOverdue: overdueSql(today),
      isDueToday: dueTodaySql(today),
      // The author's name; null once the staff member is deleted.
      createdBy: user.name,
    })
    .from(tasks)
    .leftJoin(user, eq(tasks.createdByStaffId, user.id));

/**
 * Optimistic concurrency, as for appointments: `updated_at` is microsecond
 * precision, the client's token a millisecond Date — the column is truncated
 * to the token's precision so the comparison is exact.
 */
const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${tasks.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

const taskExists = async (id: string) => {
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  return !!row;
};

export const tasksRouter = createTRPCRouter({
  /**
   * Both lists in one round trip. Order is SQL, deterministic to the id:
   * - open: important, overdue, `dueDate` ascending (none last), `createdAt`,
   *   `id`;
   * - done: `completedAt` descending, `id` — only the last 30 clinic days,
   *   at most 100 rows.
   * `canRemove` mirrors `remove`'s rule for the menu; the server re-checks.
   */
  getMany: protectedProcedure.query(async ({ ctx }) => {
    const today = clinicToday(new Date());

    const [open, done] = await db.batch([
      selectTasks(today)
        .where(eq(tasks.isDone, false))
        .orderBy(
          desc(tasks.isImportant),
          desc(overdueSql(today)),
          sql`${tasks.dueDate} ASC NULLS LAST`,
          asc(tasks.createdAt),
          asc(tasks.id),
        ),
      selectTasks(today)
        .where(
          and(
            eq(tasks.isDone, true),
            gte(tasks.completedAt, doneWindowStart(today)),
          ),
        )
        .orderBy(desc(tasks.completedAt), desc(tasks.id))
        .limit(DONE_LIMIT),
    ]);

    const isAdmin = ctx.auth.user.role === ADMIN_ROLE;
    // Not a filter: every row is returned to everyone. This only says which
    // rows show «Supprimer».
    const withPermissions = <Row extends { createdByStaffId: string | null }>(
      row: Row,
    ) => ({
      ...row,
      canRemove: isAdmin || row.createdByStaffId === ctx.auth.user.id,
    });

    return {
      open: open.map(withPermissions),
      done: done.map(withPermissions),
    };
  }),

  create: protectedProcedure
    .input(taskInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(tasks)
        .values({
          content: input.content,
          dueDate: input.dueDate,
          isImportant: input.isImportant,
          // Audit, and the author's right to delete — never a read filter.
          createdByStaffId: ctx.auth.user.id,
        })
        .returning({ id: tasks.id });

      return created;
    }),

  /** Content, due date, importance — conditional on the loaded version. */
  update: protectedProcedure
    .input(taskUpdateSchema)
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(tasks)
        .set({
          content: input.content,
          dueDate: input.dueDate,
          isImportant: input.isImportant,
          updatedAt: new Date(),
        })
        .where(
          and(eq(tasks.id, input.id), versionMatches(input.expectedUpdatedAt)),
        )
        .returning({ id: tasks.id });

      if (updated) return updated;

      // Nothing matched: deleted meanwhile, or saved by someone else first.
      if (!(await taskExists(input.id))) throw notFound();
      throw new TRPCError({ code: "CONFLICT", message: E.taskChangedMeanwhile });
    }),

  /**
   * A set, not a toggle (prompts/23, decision 3). The write only lands on a
   * row in the OTHER state, so `completedAt` is stamped once: a double tap,
   * or two staff members ticking the same task, leave the first completion
   * in place. A no-op answers success — the task IS in the requested state.
   */
  setDone: protectedProcedure
    .input(taskSetDoneSchema)
    .mutation(async ({ input }) => {
      const now = new Date();
      const [changed] = await db
        .update(tasks)
        .set({
          isDone: input.isDone,
          completedAt: input.isDone ? now : null,
          updatedAt: now,
        })
        .where(and(eq(tasks.id, input.id), eq(tasks.isDone, !input.isDone)))
        .returning({ id: tasks.id });

      if (changed) return changed;
      if (!(await taskExists(input.id))) throw notFound();
      return { id: input.id };
    }),

  /**
   * The author or the admin (prompts/23, decision 1). The permission sits in
   * the DELETE's own WHERE so the check and the write are one statement; the
   * re-select only tells «gone» from «not yours».
   */
  remove: protectedProcedure
    .input(taskIdSchema)
    .mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.auth.user.role === ADMIN_ROLE;

      const [removed] = await db
        .delete(tasks)
        .where(
          and(
            eq(tasks.id, input.id),
            isAdmin ? undefined : eq(tasks.createdByStaffId, ctx.auth.user.id),
          ),
        )
        .returning({ id: tasks.id });

      if (removed) return removed;
      if (!(await taskExists(input.id))) throw notFound();
      throw new TRPCError({ code: "FORBIDDEN", message: E.removeForbidden });
    }),
});
