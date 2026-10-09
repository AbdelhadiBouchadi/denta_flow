import { clinicInstant, toClinicDate, type ClinicDateInput } from "@/lib/time";
import type { ExpenseFormValues, ExpenseValues } from "./schemas";
import { ExpenseCategory, type ExpenseListItem } from "./types";

/**
 * The one place an expense's `spentAt` instant and the form's calendar day
 * are converted, both directions — through the clinic timezone (`TZDate`),
 * never the browser's.
 *
 * `spentAt` is a clinic DATE stored as the clinic-midnight instant of that
 * day (decision 3). Read back with `toClinicDate`, it is the same day on any
 * machine: a charge of 1 October never becomes 30 September because the
 * server runs in UTC or the browser in Tokyo.
 */

/**
 * Create-mode prefill — «Dupliquer» hands over the copied row's fields; the
 * date is never copied, it is always today. Never flips the form to edit mode.
 */
export type ExpenseFormDefaults = Partial<
  Pick<ExpenseListItem, "label" | "category" | "amountCents" | "supplier" | "notes">
>;

/** The instant stored for the submitted day, run by the procedure. */
export const resolveSpentAt = ({
  spentDate,
}: Pick<ExpenseValues, "spentDate">): Date => clinicInstant(spentDate);

/**
 * A stored expense read back for the inputs, or a blank (or duplicated) form
 * dated today on the clinic's calendar.
 */
export const toFormValues = (
  expense?: ExpenseListItem,
  defaults?: ExpenseFormDefaults,
  now: ClinicDateInput = new Date(),
): ExpenseFormValues => {
  const source = expense ?? defaults;
  return {
    label: source?.label ?? "",
    category: (source?.category as ExpenseCategory | undefined) ?? ExpenseCategory.Supplies,
    amountCents: source?.amountCents ?? null,
    spentDate: expense ? toClinicDate(expense.spentAt) : toClinicDate(now),
    supplier: source?.supplier ?? "",
    notes: source?.notes ?? "",
  };
};
