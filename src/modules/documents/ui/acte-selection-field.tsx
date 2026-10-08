"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatDH } from "@/lib/format";
import type { TreatmentListItem } from "@/modules/treatments/types";
import { DOCUMENT_COPY as COPY, DOCUMENT_COLUMN_HEADERS as H } from "../constants";
import { sumSelectedCents } from "../rules";

interface ActeSelectionFieldProps {
  /** The eligible actes only — the caller applies the document's rule. */
  items: readonly TreatmentListItem[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The actes a facture or a devis will name: one checkbox per acte (label,
 * code, date, amount), «Tout sélectionner», and the selection's total.
 *
 * The total is a PREVIEW: the procedure reads every printed figure from the
 * database and never trusts an amount from here.
 */
const ActeSelectionField = ({
  items,
  value,
  onChange,
  disabled = false,
  invalid = false,
}: ActeSelectionFieldProps) => {
  const selected = new Set(value);
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const someSelected = !allSelected && items.some((item) => selected.has(item.id));

  const toggle = (id: string, checked: boolean) =>
    onChange(
      checked
        ? items.filter((item) => selected.has(item.id) || item.id === id).map((item) => item.id)
        : value.filter((current) => current !== id),
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            disabled={disabled}
            aria-invalid={invalid}
            onCheckedChange={(checked) =>
              onChange(checked ? items.map((item) => item.id) : [])
            }
          />
          {COPY.selectAll}
        </label>
        <span className="text-muted-foreground text-xs">
          {COPY.selectedCount(value.length, items.length)}
        </span>
      </div>

      <ul className="divide-border max-h-72 divide-y overflow-y-auto rounded-lg border">
        {items.map((item) => (
          <li key={item.id}>
            <label className="hover:bg-muted/50 grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-sm">
              <Checkbox
                checked={selected.has(item.id)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(item.id, checked)}
                aria-label={item.label}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.label}</span>
                <span
                  suppressHydrationWarning
                  className="text-muted-foreground text-xs tabular-nums"
                >
                  {formatDate(item.listedAt)}
                  {item.nomenclatureCode && ` · ${item.nomenclatureCode}`}
                </span>
              </span>
              <span className="font-medium whitespace-nowrap tabular-nums">
                {formatDH(item.totalAmountCents)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="font-medium">{COPY.total}</span>
        <span className="font-semibold tabular-nums" aria-label={H.amount}>
          {formatDH(sumSelectedCents(items, value))}
        </span>
      </div>
    </div>
  );
};

export default ActeSelectionField;
