import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Expense` is a bug
 * (AGENTS.md §1 rule 6).
 */
type ExpensesOutputs = inferRouterOutputs<AppRouter>["expenses"];

/** One row of `/charges` and of `getOne` — one shape. */
export type ExpenseListItem = ExpensesOutputs["getMany"]["items"][number];

export type ExpenseSummary = ExpensesOutputs["getSummary"];

export type ExpenseCategoryShare = ExpenseSummary["byCategory"][number];

/** Mirrors the `expense_category` pgEnum, kept in lockstep (schemas.test.ts). */
export enum ExpenseCategory {
  Supplies = "supplies",
  Lab = "lab",
  Rent = "rent",
  Utilities = "utilities",
  Salaries = "salaries",
  Equipment = "equipment",
  Maintenance = "maintenance",
  Taxes = "taxes",
  Other = "other",
}
