import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  sql,
  sum,
} from "drizzle-orm";

import { db } from "@/database";
import { expenses, user } from "@/database/schema";
import { chargesColumns, spentInRange } from "@/database/sql/expenses";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { EXPENSE_SERVER_ERRORS as E } from "../constants";
import { resolveSpentAt } from "../form-values";
import { filterRange, previousPeriodRange } from "../period";
import {
  expenseCreateSchema,
  expenseGetManySchema,
  expenseIdSchema,
  expenseSummarySchema,
  expenseUpdateSchema,
  type ExpenseFilterValues,
  type ExpenseValues,
} from "../schemas";
import type { ExpenseCategory } from "../types";

/**
 * The clinic's charges. ADMIN ONLY END TO END — reads included
 * (02-auth.md §2): the takings minus the charges is the clinic's profit, and
 * the reception must not read it. Every procedure below is `adminProcedure`;
 * the hidden sidebar link is courtesy, this is the control.
 *
 * No staff scoping (AGENTS.md §2): `createdByStaffId` is stamped from the
 * session for the audit trail and never read as a filter.
 *
 * No activity-log row: «Activité du jour» is read by every staff member, and
 * a line naming a salary or the rent would leak exactly what this slice
 * hides.
 */

// ── Row shape ───────────────────────────────────────────────────────────────

/** One row shape for the list and `getOne`. */
const selectExpenses = () =>
  db
    .select({
      ...getTableColumns(expenses),
      // Audit, shown nowhere yet. Joined, never used as a filter.
      createdByStaff: { id: user.id, name: user.name },
    })
    .from(expenses)
    .leftJoin(user, eq(expenses.createdByStaffId, user.id));

/** Newest first; the id keeps pages stable (05-slice.md §5 rule 4). */
const EXPENSE_LIST_ORDER = [desc(expenses.spentAt), desc(expenses.id)] as const;

/** Escapes the ILIKE wildcards so a typed "%" matches a literal per cent sign. */
const likePattern = (search: string) =>
  `%${search.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Everything but the period — shared by the list, the summary and the
 * summary's previous period, so all three describe the same kind of rows.
 */
const matchesFilters = ({
  search,
  category,
}: Pick<ExpenseFilterValues, "search" | "category">) => {
  const term = search?.trim();
  return and(
    term
      ? or(
          ilike(expenses.label, likePattern(term)),
          ilike(expenses.supplier, likePattern(term)),
        )
      : undefined,
    category ? eq(expenses.category, category) : undefined,
  );
};

/**
 * ONE predicate for the page, the count and the summary (05-slice.md §5
 * rule 6). Clinic-day bounds go through TZDate — never a hardcoded offset.
 */
const filtersWhere = (filters: ExpenseFilterValues) =>
  and(matchesFilters(filters), spentInRange(filterRange(filters.from, filters.to)));

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: E.notFound });
const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: E.changedMeanwhile });

/** The columns a create or an update writes — the input never spreads raw. */
const writableValues = (input: ExpenseValues) => ({
  label: input.label,
  category: input.category,
  amountCents: input.amountCents,
  spentAt: resolveSpentAt(input),
  supplier: input.supplier,
  notes: input.notes,
});

/**
 * Optimistic concurrency, as for payments: `updated_at` is microsecond
 * precision, the client's token a millisecond Date — the column is truncated
 * to the token's precision so the comparison is exact.
 */
const versionMatches = (version: Date) =>
  sql`date_trunc('milliseconds', ${expenses.updatedAt}) = ${version.toISOString()}::timestamp`;

/** Nothing matched: deleted meanwhile, or saved by someone else first. */
const notFoundOrConflict = async (id: string): Promise<never> => {
  const [still] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  throw still ? conflict() : notFound();
};

/** A category's share of the total, whole per cent, for the bars. */
const sharePercent = (part: number, total: number) =>
  total > 0 ? Math.round((part * 100) / total) : 0;

// ── Router ──────────────────────────────────────────────────────────────────

export const expensesRouter = createTRPCRouter({
  /** `/charges`, a page at a time. */
  getMany: adminProcedure
    .input(expenseGetManySchema)
    .query(async ({ input }) => {
      const { page, pageSize } = input;
      const where = filtersWhere(input);

      const [rows, [totals]] = await Promise.all([
        selectExpenses()
          .where(where)
          .orderBy(...EXPENSE_LIST_ORDER)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ count: count() }).from(expenses).where(where),
      ]);

      return {
        items: rows,
        total: totals.count,
        totalPages: Math.ceil(totals.count / pageSize),
      };
    }),

  /** The edit form's reload after a CONFLICT. */
  getOne: adminProcedure.input(expenseIdSchema).query(async ({ input }) => {
    const [row] = await selectExpenses().where(eq(expenses.id, input.id));
    if (!row) throw notFound();
    return row;
  }),

  /**
   * The strip above the list, for the ACTIVE filters — every figure in SQL:
   *
   * - total and count, through the shared `chargesColumns` fragment (the
   *   dashboard's «Charges» is the same fragment over its period);
   * - the breakdown by category, largest first;
   * - the same-length period just before, same search and category, when
   *   both bounds are set (null otherwise — an open period has no
   *   «previous»).
   */
  getSummary: adminProcedure
    .input(expenseSummarySchema)
    .query(async ({ input }) => {
      const where = filtersWhere(input);
      const previousRange = previousPeriodRange(input.from, input.to);
      const categoryTotal = sql<number>`COALESCE(${sum(expenses.amountCents)}, 0)::int`;

      const [[totals], breakdown, previous] = await Promise.all([
        db.select(chargesColumns).from(expenses).where(where),
        db
          .select({ category: expenses.category, totalCents: categoryTotal })
          .from(expenses)
          .where(where)
          .groupBy(expenses.category)
          // Ties broken by the enum value: a stable order between refetches.
          .orderBy(desc(categoryTotal), expenses.category),
        previousRange
          ? db
              .select(chargesColumns)
              .from(expenses)
              .where(and(matchesFilters(input), spentInRange(previousRange)))
          : null,
      ]);

      return {
        totalCents: totals.chargesCents,
        count: totals.expenseCount,
        byCategory: breakdown.map((row) => ({
          // The pgEnum values and the TS enum are kept in lockstep (types.ts).
          category: row.category as ExpenseCategory,
          totalCents: row.totalCents,
          percent: sharePercent(row.totalCents, totals.chargesCents),
        })),
        previousPeriodTotalCents: previous ? previous[0].chargesCents : null,
      };
    }),

  create: adminProcedure
    .input(expenseCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(expenses)
        .values({
          ...writableValues(input),
          // Audit only, from the session — never read as a filter.
          createdByStaffId: ctx.auth.user.id,
        })
        .returning();
      return created;
    }),

  /**
   * Conditional on `expectedUpdatedAt`, the version the editor loaded
   * (decision 6): a save over someone else's edit is a CONFLICT, never a
   * silent overwrite.
   */
  update: adminProcedure
    .input(expenseUpdateSchema)
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(expenses)
        .set({ ...writableValues(input), updatedAt: new Date() })
        .where(
          and(
            eq(expenses.id, input.id),
            versionMatches(input.expectedUpdatedAt),
          ),
        )
        .returning();

      if (updated) return updated;
      return notFoundOrConflict(input.id);
    }),

  /**
   * A hard delete: an expense is not a fiscal document (decision 6). The UI
   * confirms first and says the net changes.
   */
  remove: adminProcedure
    .input(expenseIdSchema)
    .mutation(async ({ input }) => {
      const [removed] = await db
        .delete(expenses)
        .where(eq(expenses.id, input.id))
        .returning({ id: expenses.id });
      if (!removed) throw notFound();
      return removed;
    }),
});
