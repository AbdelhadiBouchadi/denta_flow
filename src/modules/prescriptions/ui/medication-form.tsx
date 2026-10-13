"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  MEDICATION_FIELD_MAX,
  MEDICATION_FORMS,
  PRESCRIPTION_COPY as COPY,
} from "../constants";
import { useInvalidatePrescriptions } from "../hooks/use-invalidate-prescriptions";
import {
  medicationFormSchema,
  type MedicationFormInput,
  type MedicationFormValues,
} from "../schemas";
import type { MedicationListItem } from "../types";

interface MedicationFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: MedicationListItem;
  onSuccess: () => void;
  onCancel: () => void;
}

const FORMS_LIST_ID = "medication-forms";

const toFormValues = (medication?: MedicationListItem): MedicationFormInput => ({
  name: medication?.name ?? "",
  form: medication?.form ?? "",
  strength: medication?.strength ?? "",
  defaultPosology: medication?.defaultPosology ?? "",
  defaultDuration: medication?.defaultDuration ?? "",
});

/**
 * Add or edit a medication. The edit carries the row's `updatedAt` as
 * `expectedUpdatedAt`: a save over someone else's change is refused in
 * French rather than silently overwriting it.
 */
export const MedicationForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: MedicationFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidatePrescriptions();
  const isEdit = Boolean(initialValues);

  const form = useForm<MedicationFormInput, unknown, MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: toFormValues(initialValues),
  });

  const onDone = (message: string) => async () => {
    await invalidate();
    toast.success(message);
    onSuccess();
  };
  // Both refresh through the one invalidation block (06-ui.md §6 rule 2).
  const create = useMutation(
    trpc.medications.create.mutationOptions({
      onSuccess: onDone(COPY.medicationCreated),
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const update = useMutation(
    trpc.medications.update.mutationOptions({
      onSuccess: onDone(COPY.medicationUpdated),
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        // A CONFLICT means the list is stale: re-read it.
        await invalidate();
      },
    }),
  );
  const isPending = create.isPending || update.isPending;

  const onSubmit = (values: MedicationFormValues) => {
    if (initialValues) {
      update.mutate({
        ...values,
        id: initialValues.id,
        expectedUpdatedAt: initialValues.updatedAt,
      });
      return;
    }
    create.mutate(values);
  };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-h-[70vh] min-w-0 flex-col gap-6 overflow-y-auto px-1"
    >
      <FieldGroup className="gap-4">
        <TextField
          control={form.control}
          name="name"
          label={COPY.name}
          maxLength={MEDICATION_FIELD_MAX.name}
          disabled={isPending}
        />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {/* Free text with suggestions: a clinic may type another form. */}
          <TextField
            control={form.control}
            name="form"
            label={COPY.form}
            placeholder={COPY.formPlaceholder}
            maxLength={MEDICATION_FIELD_MAX.form}
            disabled={isPending}
            list={FORMS_LIST_ID}
          />
          <TextField
            control={form.control}
            name="strength"
            label={COPY.strength}
            maxLength={MEDICATION_FIELD_MAX.strength}
            disabled={isPending}
          />
        </div>
        <datalist id={FORMS_LIST_ID}>
          {MEDICATION_FORMS.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <TextField
          control={form.control}
          name="defaultPosology"
          label={COPY.defaultPosology}
          placeholder={COPY.posologyPlaceholder}
          maxLength={MEDICATION_FIELD_MAX.posology}
          disabled={isPending}
        />
        <TextField
          control={form.control}
          name="defaultDuration"
          label={COPY.defaultDuration}
          placeholder={COPY.durationPlaceholder}
          maxLength={MEDICATION_FIELD_MAX.duration}
          disabled={isPending}
          description={COPY.medicationDialogDescription}
        />
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={onCancel}
        >
          {COPY.cancel}
        </Button>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <Spinner />}
          {isPending ? COPY.saving : isEdit ? COPY.save : COPY.addMedicationButton}
        </Button>
      </div>
    </form>
  );
};

const TextField = ({
  control,
  name,
  label,
  placeholder,
  maxLength,
  disabled,
  list,
  description,
}: {
  control: Control<MedicationFormInput, unknown, MedicationFormValues>;
  name: keyof MedicationFormInput;
  label: string;
  placeholder?: string;
  maxLength: number;
  disabled: boolean;
  list?: string;
  description?: string;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid} className="min-w-0">
        <FieldLabel htmlFor={`medication-${name}`}>{label}</FieldLabel>
        <Input
          {...field}
          value={field.value ?? ""}
          id={`medication-${name}`}
          autoComplete="off"
          list={list}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          className="h-9"
        />
        {description && <FieldDescription>{description}</FieldDescription>}
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
