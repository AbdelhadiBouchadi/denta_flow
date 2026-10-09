import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { isCalendarDate, toClinicDate } from "@/lib/time";
import {
  EXPENSE_LABEL_MAX,
  EXPENSE_NOTES_MAX,
  EXPENSE_SUPPLIER_MAX,
  EXPENSE_VALIDATION_MESSAGES as M,
} from "./constants";
import { ExpenseCategory } from "./types";

/**
 * One schema, two consumers: the procedure's `.input()` and the form's
 * `zodResolver`. Every message is rendered verbatim to a user (06-ui.md §10).
 *
 * `spentDate` travels as a clinic calendar day ("yyyy-MM-dd") and becomes an
 * instant in exactly one place, `resolveSpentAt` (form-values.ts). No offset
 * is computed in the browser.
 */

const id = z.string().min(1, { message: "Identifiant requis" });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .nullish()
    .transform((value) => (value ? value : null));

/**
 * Integer centimes, strictly positive (decision 2: no negative expense, no
 * refund model). `null` is what a cleared MoneyInput holds.
 */
export const expenseAmountSchema = z
  .number({ message: M.amountPositive })
  .nullable()
  .pipe(
    z
      .number({ message: M.amountPositive })
      .int({ message: M.amountInvalid })
      .positive({ message: M.amountPositive }),
  );

/**
 * The form. «Today» is read when the schema runs, on the CLINIC calendar, so
 * the same schema refuses a future day in the browser and again on the
 * server. Calendar days compare as strings ("yyyy-MM-dd").
 */
export const expenseFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: M.labelRequired })
    .max(EXPENSE_LABEL_MAX, { message: M.labelTooLong }),
  category: z.enum(ExpenseCategory, { message: M.categoryInvalid }),
  amountCents: expenseAmountSchema,
  /** "yyyy-MM-dd", a clinic calendar day — past or today, never later. */
  spentDate: z
    .string()
    .refine(isCalendarDate, { message: M.dateInvalid })
    .refine((day) => day <= toClinicDate(new Date()), {
      message: M.inFuture,
    }),
  supplier: optionalText(EXPENSE_SUPPLIER_MAX, M.supplierTooLong),
  notes: optionalText(EXPENSE_NOTES_MAX, M.notesTooLong),
});

export const expenseCreateSchema = expenseFormSchema;

/** Update = form + id + the version token the editor loaded (decision 6). */
export const expenseUpdateSchema = expenseFormSchema.extend({
  id,
  expectedUpdatedAt: z.date(),
});

export const expenseIdSchema = z.object({ id });

/**
 * The filters `getMany` and `getSummary` share — the summary describes
 * exactly the rows the list shows. `from` / `to` are clinic calendar days
 * ("" ⇒ open-ended); a malformed one is ignored.
 */
const expenseFilters = {
  search: z.string().nullish(),
  category: z.enum(ExpenseCategory).nullish(),
  from: z.string().default(""),
  to: z.string().default(""),
};

/**
 * The `/charges` list. The bounds are the shared ones in src/constants.ts —
 * the nuqs parsers read the same `DEFAULT_PAGE`.
 */
export const expenseGetManySchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  ...expenseFilters,
});

export const expenseSummarySchema = z.object(expenseFilters);

/** What the form holds while it is being typed. */
export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
/** What the procedure receives once the schema has normalised it. */
export type ExpenseValues = z.output<typeof expenseFormSchema>;
export type ExpenseFilterValues = z.output<typeof expenseSummarySchema>;
