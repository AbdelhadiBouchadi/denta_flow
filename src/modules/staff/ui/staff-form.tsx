"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { Controller, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";

import { COLOR_PALETTE, ColorPicker } from "@/components/shared/color-picker";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  DEFAULT_STAFF_ROLE,
  STAFF_COPY,
  STAFF_FIELD_LABELS,
  STAFF_FIELD_PLACEHOLDERS,
  STAFF_ROLE_OPTIONS,
} from "../constants";
import { useInvalidateStaff } from "../hooks/use-invalidate-staff";
import {
  staffInsertSchema,
  type StaffFormValues,
  type StaffInsertValues,
} from "../schemas";
import type { StaffCreated, StaffListItem, StaffRole } from "../types";

interface StaffFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: StaffListItem;
  /** Receives the one-time password on create; nothing on edit. */
  onSuccess?: (created?: StaffCreated) => void;
  onCancel?: () => void;
}

const toFormValues = (staff?: StaffListItem): StaffFormValues => ({
  name: staff?.name ?? "",
  email: staff?.email ?? "",
  role: (staff?.role as StaffRole | undefined) ?? DEFAULT_STAFF_ROLE,
  title: staff?.title ?? "",
  inpe: staff?.inpe ?? "",
  color: staff?.color ?? COLOR_PALETTE[0].value,
});

/**
 * Create and edit. The e-mail, the role and the password notice appear on
 * create only: an e-mail is the sign-in identity and is not edited here, and
 * the role has its own action, guarded on the server. In edit mode they still
 * hold the row's values, so the one schema validates both modes, and only the
 * profile fields are sent.
 */
export const StaffForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: StaffFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateStaff();
  const isEdit = !!initialValues;

  const form = useForm<StaffFormValues, unknown, StaffInsertValues>({
    resolver: zodResolver(staffInsertSchema),
    defaultValues: toFormValues(initialValues),
  });

  const createStaff = useMutation(
    trpc.staff.create.mutationOptions({
      onSuccess: async (created) => {
        await invalidateAll();
        toast.success(STAFF_COPY.created);
        onSuccess?.(created);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateStaff = useMutation(
    trpc.staff.updateProfile.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(STAFF_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createStaff.isPending || updateStaff.isPending;

  const onSubmit = (values: StaffInsertValues) => {
    if (isEdit) {
      const { name, title, inpe, color } = values;
      updateStaff.mutate({ id: initialValues.id, name, title, inpe, color });
      return;
    }
    createStaff.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldGroup className="gap-4">
        <TextField
          control={form.control}
          name="name"
          disabled={isPending}
          autoFocus
        />

        {!isEdit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="email"
              type="email"
              autoComplete="off"
              disabled={isPending}
            />
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {STAFF_FIELD_LABELS.role}
                  </FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                    disabled={isPending}
                    items={STAFF_ROLE_OPTIONS}
                  >
                    <SelectTrigger size="default" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="title" disabled={isPending} />
          <TextField
            control={form.control}
            name="inpe"
            inputMode="numeric"
            disabled={isPending}
          />
        </div>

        <Controller
          control={form.control}
          name="color"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`${field.name}-label`}>
                {STAFF_FIELD_LABELS.color}
              </FieldLabel>
              <ColorPicker
                id={field.name}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                aria-labelledby={`${field.name}-label`}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {!isEdit && (
          <p className="bg-muted text-foreground-secondary flex gap-2 rounded-lg p-3 text-sm">
            <KeyRoundIcon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            {STAFF_COPY.passwordNotice}
          </p>
        )}
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            {STAFF_COPY.cancel}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending && (
            <Spinner
              aria-label={isEdit ? STAFF_COPY.updating : STAFF_COPY.saving}
            />
          )}
          {isPending
            ? isEdit
              ? STAFF_COPY.updating
              : STAFF_COPY.saving
            : isEdit
              ? STAFF_COPY.update
              : STAFF_COPY.save}
        </Button>
      </div>
    </form>
  );
};

interface TextFieldProps {
  control: Control<StaffFormValues>;
  name: "name" | "email" | "title" | "inpe";
  disabled: boolean;
  type?: "email";
  inputMode?: "numeric";
  autoComplete?: "off";
  autoFocus?: boolean;
}

/** The five-part field shape — label, input, error — for every text field. */
const TextField = ({
  control,
  name,
  disabled,
  type,
  inputMode,
  autoComplete,
  autoFocus,
}: TextFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{STAFF_FIELD_LABELS[name]}</FieldLabel>
        <Input
          {...field}
          id={field.name}
          value={field.value ?? ""}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          placeholder={STAFF_FIELD_PLACEHOLDERS[name]}
          className="h-9"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
