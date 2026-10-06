"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

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
  INSURER_COPY,
  INSURER_FIELD_LABELS,
  INSURER_FIELD_PLACEHOLDERS,
} from "../constants";
import { useInvalidateInsurers } from "../hooks/use-invalidate-insurers";
import {
  insurerFormSchema,
  type InsurerFormValues,
  type InsurerValues,
} from "../schemas";
import type { InsurerListItem } from "../types";

interface InsurerFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: InsurerListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const InsurerForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: InsurerFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateInsurers();
  const isEdit = !!initialValues;

  const form = useForm<InsurerFormValues, unknown, InsurerValues>({
    resolver: zodResolver(insurerFormSchema),
    defaultValues: { name: initialValues?.name ?? "" },
  });

  const createInsurer = useMutation(
    trpc.insurers.create.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(INSURER_COPY.created);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateInsurer = useMutation(
    trpc.insurers.update.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(INSURER_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createInsurer.isPending || updateInsurer.isPending;

  const onSubmit = (values: InsurerValues) => {
    if (isEdit) {
      updateInsurer.mutate({ id: initialValues.id, ...values });
      return;
    }
    createInsurer.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6 px-4"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {INSURER_FIELD_LABELS.name}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoFocus
                autoComplete="off"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={INSURER_FIELD_PLACEHOLDERS.name}
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
            {INSURER_COPY.cancel}
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
              aria-label={isEdit ? INSURER_COPY.updating : INSURER_COPY.saving}
            />
          )}
          {isPending
            ? isEdit
              ? INSURER_COPY.updating
              : INSURER_COPY.saving
            : isEdit
              ? INSURER_COPY.update
              : INSURER_COPY.save}
        </Button>
      </div>
    </form>
  );
};
