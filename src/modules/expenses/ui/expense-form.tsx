"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import MoneyInput from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { WEEK_STARTS_ON } from "@/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatCalendarDate } from "@/lib/format";
import { clinicNow, toClinicDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COPY as COPY,
  EXPENSE_FIELD_LABELS as L,
  EXPENSE_FIELD_PLACEHOLDERS as P,
} from "../constants";
import { toFormValues, type ExpenseFormDefaults } from "../form-values";
import { useInvalidateExpenses } from "../hooks/use-invalidate-expenses";
import {
  expenseFormSchema,
  type ExpenseFormValues,
  type ExpenseValues,
} from "../schemas";
import type { ExpenseListItem } from "../types";

interface ExpenseFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: ExpenseListItem;
  /** Create mode only — «Dupliquer»'s prefill, always dated today. */
  defaultValues?: ExpenseFormDefaults;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * «Nouvelle charge» / «Modifier» / «Dupliquer». The date is a clinic
 * calendar day — the picker offers no future day, the schema refuses one
 * again, and the server turns the day into the clinic-midnight instant.
 */
export const ExpenseForm = ({
  initialValues,
  defaultValues,
  onSuccess,
  onCancel,
}: ExpenseFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateAll = useInvalidateExpenses();
  const isEdit = !!initialValues;

  // The version token of the row being edited — moved only by a reload after
  // a CONFLICT, never by a background refetch.
  const [version, setVersion] = useState<Date | undefined>(
    initialValues?.updatedAt,
  );

  const form = useForm<ExpenseFormValues, unknown, ExpenseValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: toFormValues(initialValues, defaultValues),
  });

  const createExpense = useMutation(trpc.expenses.create.mutationOptions());
  const updateExpense = useMutation(trpc.expenses.update.mutationOptions());
  const isPending = createExpense.isPending || updateExpense.isPending;

  /** Reload the saved version after a CONFLICT — «Rechargez-la». */
  const reloadAfterConflict = async (id: string) => {
    await invalidateAll();
    const fresh = await queryClient
      .fetchQuery(trpc.expenses.getOne.queryOptions({ id }))
      .catch(() => null);
    if (!fresh) return;
    setVersion(fresh.updatedAt);
    form.reset(toFormValues(fresh));
  };

  const submit = async (values: ExpenseValues) => {
    try {
      if (isEdit) {
        await updateExpense.mutateAsync({
          ...values,
          id: initialValues.id,
          expectedUpdatedAt: version ?? initialValues.updatedAt,
        });
      } else {
        await createExpense.mutateAsync(values);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      const code = (error as { data?: { code?: string } | null }).data?.code;
      if (isEdit && code === "CONFLICT") {
        await reloadAfterConflict(initialValues.id);
      }
      return;
    }

    // The same invalidation for create and update — one block.
    await invalidateAll();
    toast.success(isEdit ? COPY.updated : COPY.created);
    onSuccess?.();
  };

  const submitLabel = isPending
    ? isEdit
      ? COPY.updating
      : COPY.saving
    : isEdit
      ? COPY.update
      : COPY.save;

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      noValidate
      // A size container: the rows switch on the FORM's width — the same form
      // sits in a dialog and a phone-width drawer.
      className="@container flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="flex max-h-[70vh] min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4">
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="label"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.label}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  autoComplete="off"
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={P.label}
                  className="h-9"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.category}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                    disabled={isPending}
                    items={EXPENSE_CATEGORY_OPTIONS}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full min-w-0"
                    >
                      <SelectValue placeholder={P.category} />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORY_OPTIONS.map((option) => (
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

            <Controller
              control={form.control}
              name="amountCents"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.amount}</FieldLabel>
                  <MoneyInput
                    id={field.name}
                    name={field.name}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="spentDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.spentDate}</FieldLabel>
                  {/* The picker's Dates are only read for their calendar
                      fields ("yyyy-MM-dd"); the instant is resolved on the
                      server through the clinic timezone. */}
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          id={field.name}
                          type="button"
                          variant="outline"
                          size="lg"
                          disabled={isPending}
                          aria-invalid={fieldState.invalid}
                          className="w-full min-w-0 justify-between font-normal tabular-nums"
                        />
                      }
                    >
                      {field.value ? (
                        formatCalendarDate(field.value)
                      ) : (
                        <span className="text-muted-foreground">{P.date}</span>
                      )}
                      <CalendarIcon className="text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        locale={fr}
                        weekStartsOn={WEEK_STARTS_ON}
                        defaultMonth={
                          field.value ? parseISO(field.value) : clinicNow()
                        }
                        selected={
                          field.value ? parseISO(field.value) : undefined
                        }
                        disabled={{ after: parseISO(toClinicDate(clinicNow())) }}
                        onSelect={(day) =>
                          day && field.onChange(format(day, "yyyy-MM-dd"))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="supplier"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.supplier}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    value={field.value ?? ""}
                    autoComplete="off"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    placeholder={P.supplier}
                    className="h-9"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.notes}</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  rows={2}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={P.notes}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <div className="flex flex-col-reverse gap-2 px-4 @md:flex-row @md:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="w-full @md:w-auto"
          >
            {COPY.cancel}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full @md:w-auto"
        >
          {isPending && <Spinner aria-label={submitLabel} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
