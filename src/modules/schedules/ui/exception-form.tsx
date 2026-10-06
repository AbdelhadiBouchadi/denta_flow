"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { TimeField } from "@/components/shared/time-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
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
import { EXCEPTION_COPY, SCHEDULE_MINUTE_STEP } from "../constants";
import { useInvalidateSchedules } from "../hooks/use-invalidate-schedules";
import {
  exceptionFormSchema,
  type ExceptionFormValues,
  type ExceptionValues,
} from "../schemas";
import type { ScheduleExceptionListItem } from "../types";
import { DateRangeField } from "./date-range-field";

interface ExceptionFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: ScheduleExceptionListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (
  exception?: ScheduleExceptionListItem,
): ExceptionFormValues => ({
  practitionerId: exception?.practitionerId ?? null,
  startDate: exception?.period.startDate ?? "",
  endDate: exception?.period.endDate ?? "",
  allDay: exception?.period.allDay ?? true,
  startTime: exception?.period.startTime ?? "",
  endTime: exception?.period.endTime ?? "",
  reason: exception?.reason ?? "",
});

export const ExceptionForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: ExceptionFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateSchedules();
  const isEdit = !!initialValues;

  // Prefetched by the page with the rest of «Horaires».
  const { data: practitioners } = useSuspenseQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );

  // A closure already naming a since-deactivated practitioner keeps them.
  const scopeOptions = [
    { value: null, label: EXCEPTION_COPY.clinicWide },
    ...practitioners.items.map(({ id, name }) => ({ value: id, label: name })),
    ...(initialValues?.practitionerId &&
    !practitioners.items.some(({ id }) => id === initialValues.practitionerId)
      ? [
          {
            value: initialValues.practitionerId,
            label: initialValues.practitionerName ?? "",
          },
        ]
      : []),
  ];

  const form = useForm<ExceptionFormValues, unknown, ExceptionValues>({
    resolver: zodResolver(exceptionFormSchema),
    defaultValues: toFormValues(initialValues),
  });

  const [allDay, endDate] = useWatch({
    control: form.control,
    name: ["allDay", "endDate"],
  });

  const createException = useMutation(
    trpc.schedules.createException.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(EXCEPTION_COPY.created);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateException = useMutation(
    trpc.schedules.updateException.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(EXCEPTION_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createException.isPending || updateException.isPending;

  const onSubmit = (values: ExceptionValues) => {
    if (isEdit) {
      updateException.mutate({ id: initialValues.id, ...values });
      return;
    }
    createException.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="practitionerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {EXCEPTION_COPY.scope}
              </FieldLabel>
              <Select
                id={field.name}
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? null)}
                disabled={isPending}
                items={scopeOptions}
              >
                <SelectTrigger size="default" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((option) => (
                    <SelectItem
                      key={option.value ?? "clinic"}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="startDate"
          render={({ field, fieldState }) => {
            const endDateError = form.formState.errors.endDate;
            return (
              <Field data-invalid={fieldState.invalid || !!endDateError}>
                <FieldLabel htmlFor={field.name}>
                  {EXCEPTION_COPY.dates}
                </FieldLabel>
                <DateRangeField
                  id={field.name}
                  startDate={field.value}
                  endDate={endDate}
                  onChange={({ startDate, endDate }) => {
                    field.onChange(startDate);
                    form.setValue("endDate", endDate, {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    });
                  }}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid || !!endDateError}
                />
                {(fieldState.invalid || endDateError) && (
                  <FieldError errors={[fieldState.error, endDateError]} />
                )}
              </Field>
            );
          }}
        />

        <Controller
          control={form.control}
          name="allDay"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
                disabled={isPending}
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={field.name}>
                  {EXCEPTION_COPY.allDay}
                </FieldLabel>
                <FieldDescription>{EXCEPTION_COPY.allDayHint}</FieldDescription>
              </div>
            </Field>
          )}
        />

        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["startTime", "endTime"] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      {EXCEPTION_COPY[name]}
                    </FieldLabel>
                    <TimeField
                      id={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      minuteStep={SCHEDULE_MINUTE_STEP}
                      disabled={isPending}
                      aria-invalid={fieldState.invalid}
                      aria-label={EXCEPTION_COPY[name]}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ))}
          </div>
        )}

        <Controller
          control={form.control}
          name="reason"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {EXCEPTION_COPY.reason}
              </FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                id={field.name}
                autoComplete="off"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={EXCEPTION_COPY.reasonPlaceholder}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
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
            {EXCEPTION_COPY.cancel}
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
              aria-label={
                isEdit ? EXCEPTION_COPY.updating : EXCEPTION_COPY.saving
              }
            />
          )}
          {isPending
            ? isEdit
              ? EXCEPTION_COPY.updating
              : EXCEPTION_COPY.saving
            : isEdit
              ? EXCEPTION_COPY.update
              : EXCEPTION_COPY.save}
        </Button>
      </div>
    </form>
  );
};
