"use client";

import * as React from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { CURRENCY_SUFFIX } from "@/constants";
import { formatDH, parseDH } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The `1 250,00 | DH` split field.
 *
 * Value in and out is **integer centimes** — the form, the Zod schema and the
 * procedure all speak centimes, and this is the one component in the UI that
 * calls `parseDH`. Nothing downstream ever divides by 100.
 */
interface MoneyInputProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Integer centimes, or null when the field is empty. */
  value: number | null;
  /** Integer centimes, or null when the field has been cleared. */
  onChange: (cents: number | null) => void;
}

// Keystrokes a French amount can be made of. Anything else never reaches the
// draft, so `parseDH` is never handed something it would read as NaN.
const ALLOWED_CHARACTERS = /[^\d\s.,-]/g;

const toDisplayValue = (cents: number | null) =>
  cents === null || Number.isNaN(cents)
    ? ""
    : formatDH(cents).replace(` ${CURRENCY_SUFFIX}`, "");

const MoneyInput = ({
  value,
  onChange,
  onBlur,
  className,
  ...props
}: MoneyInputProps) => {
  // While the field has focus the raw keystrokes win: reformatting mid-entry
  // would eat the comma the moment it is typed.
  const [draft, setDraft] = React.useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(ALLOWED_CHARACTERS, "");
    setDraft(raw);

    if (!/\d/.test(raw)) {
      onChange(null);
      return;
    }

    onChange(parseDH(raw));
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Drop the draft so the canonical rendering comes back from the value.
    setDraft(null);
    onBlur?.(event);
  };

  return (
    <InputGroup className={cn("h-9", className)}>
      <InputGroupInput
        {...props}
        inputMode="decimal"
        autoComplete="off"
        placeholder={props.placeholder ?? "0,00"}
        className="text-right tabular-nums"
        value={draft ?? toDisplayValue(value)}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <InputGroupAddon align="inline-end" className="border-input border-l">
        <InputGroupText className="font-medium">
          {CURRENCY_SUFFIX}
        </InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
};

export default MoneyInput;
