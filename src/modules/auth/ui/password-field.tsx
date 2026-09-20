"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

interface Props<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  /** "current-password" on sign-in, "new-password" on sign-up. */
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
}

/**
 * A password input with a reveal toggle, wired to react-hook-form.
 *
 * Three fields across the two auth forms need exactly this, so the reveal state
 * lives here once rather than three times. It stays in the slice's `ui/`, not in
 * `components/shared/`, because only this slice uses it (AGENTS.md §4).
 *
 * Generic over the form's value type so `name` is checked against the schema —
 * a typo in a field name is a compile error, not a silently dead input.
 */
export const PasswordField = <TValues extends FieldValues>({
  control,
  name,
  label,
  autoComplete,
  disabled,
}: Props<TValues>) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupInput
              {...field}
              id={field.name}
              type={isRevealed ? "text" : "password"}
              autoComplete={autoComplete}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              placeholder="••••••••"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                onClick={() => setIsRevealed((revealed) => !revealed)}
                disabled={disabled}
                aria-label={
                  isRevealed
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
};
