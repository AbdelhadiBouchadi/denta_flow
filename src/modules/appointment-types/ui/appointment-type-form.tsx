"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  APPOINTMENT_TYPE_COPY,
  APPOINTMENT_TYPE_DEFAULT_DURATION,
  APPOINTMENT_TYPE_DURATION_MAX,
  APPOINTMENT_TYPE_DURATION_MIN,
  APPOINTMENT_TYPE_DURATION_STEP,
  APPOINTMENT_TYPE_FIELD_LABELS,
  APPOINTMENT_TYPE_FIELD_PLACEHOLDERS,
} from "../constants";
import { useInvalidateAppointmentTypes } from "../hooks/use-invalidate-appointment-types";
import {
  appointmentTypeFormSchema,
  type AppointmentTypeFormValues,
  type AppointmentTypeValues,
} from "../schemas";
import type { AppointmentTypeListItem } from "../types";
import { AgendaBlockPreview } from "./agenda-block-preview";

interface AppointmentTypeFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: AppointmentTypeListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (
  type?: AppointmentTypeListItem,
): AppointmentTypeFormValues => ({
  label: type?.label ?? "",
  color: type?.color ?? COLOR_PALETTE[0].value,
  defaultDurationMinutes:
    type?.defaultDurationMinutes ?? APPOINTMENT_TYPE_DEFAULT_DURATION,
});

const fromNumberInput = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

export const AppointmentTypeForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: AppointmentTypeFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointmentTypes();
  const isEdit = !!initialValues;

  const form = useForm<
    AppointmentTypeFormValues,
    unknown,
    AppointmentTypeValues
  >({
    resolver: zodResolver(appointmentTypeFormSchema),
    defaultValues: toFormValues(initialValues),
  });

  // The live preview renders an agenda block in the chosen colour.
  const [label, color, duration] = useWatch({
    control: form.control,
    name: ["label", "color", "defaultDurationMinutes"],
  });

  const createType = useMutation(
    trpc.appointmentTypes.create.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_TYPE_COPY.created);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateType = useMutation(
    trpc.appointmentTypes.update.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_TYPE_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createType.isPending || updateType.isPending;

  const onSubmit = (values: AppointmentTypeValues) => {
    if (isEdit) {
      updateType.mutate({ id: initialValues.id, ...values });
      return;
    }
    createType.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldGroup className="gap-4">
        <div className="bg-muted flex flex-col gap-2 rounded-lg p-3">
          <span className="text-label text-muted-foreground uppercase">
            {APPOINTMENT_TYPE_FIELD_LABELS.preview}
          </span>
          <AgendaBlockPreview
            label={label?.trim() || APPOINTMENT_TYPE_COPY.previewFallback}
            color={color}
            durationMinutes={duration}
          />
        </div>

        <Controller
          control={form.control}
          name="label"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {APPOINTMENT_TYPE_FIELD_LABELS.label}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoFocus
                autoComplete="off"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={APPOINTMENT_TYPE_FIELD_PLACEHOLDERS.label}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="defaultDurationMinutes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {APPOINTMENT_TYPE_FIELD_LABELS.defaultDurationMinutes}
              </FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                ref={field.ref}
                type="number"
                inputMode="numeric"
                min={APPOINTMENT_TYPE_DURATION_MIN}
                max={APPOINTMENT_TYPE_DURATION_MAX}
                step={APPOINTMENT_TYPE_DURATION_STEP}
                value={Number.isNaN(field.value) ? "" : field.value}
                onChange={(event) =>
                  field.onChange(fromNumberInput(event.target.value))
                }
                onBlur={field.onBlur}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                className="h-9 w-32 tabular-nums"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="color"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`${field.name}-label`}>
                {APPOINTMENT_TYPE_FIELD_LABELS.color}
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
            {APPOINTMENT_TYPE_COPY.cancel}
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
                isEdit
                  ? APPOINTMENT_TYPE_COPY.updating
                  : APPOINTMENT_TYPE_COPY.saving
              }
            />
          )}
          {isPending
            ? isEdit
              ? APPOINTMENT_TYPE_COPY.updating
              : APPOINTMENT_TYPE_COPY.saving
            : isEdit
              ? APPOINTMENT_TYPE_COPY.update
              : APPOINTMENT_TYPE_COPY.save}
        </Button>
      </div>
    </form>
  );
};
