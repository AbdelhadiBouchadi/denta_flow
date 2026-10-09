import StatusBadge from "@/components/shared/status-badge";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_TONES,
} from "../constants";
import type { ExpenseCategory } from "../types";

/** A category as the list shows it: label and tone from the slice maps. */
const ExpenseCategoryBadge = ({ category }: { category: ExpenseCategory }) => (
  <StatusBadge
    label={EXPENSE_CATEGORY_LABELS[category]}
    tone={EXPENSE_CATEGORY_TONES[category]}
  />
);

export default ExpenseCategoryBadge;
