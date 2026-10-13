"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
} from "react-hook-form";
import { toast } from "sonner";

import CommandSelect from "@/components/shared/command-select";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  MEDICATION_FIELD_MAX,
  MEDICATION_PICKER_LIMIT,
  PACK_FIELD_MAX,
  PACK_MAX_ITEMS,
  PRESCRIPTION_COPY as COPY,
} from "../constants";
import { useInvalidatePrescriptions } from "../hooks/use-invalidate-prescriptions";
import { formatMedicationLabel } from "../normalize";
import {
  packFormSchema,
  type PackFormInput,
  type PackFormValues,
} from "../schemas";
import { MedicationStatusFilter, type PrescriptionPackItem } from "../types";

interface PackFormProps {
  /** Present ⇒ edit mode. */
  initialValues?: PrescriptionPackItem;
  onSuccess: () => void;
  onCancel: () => void;
}

/** The same picker query as the ordonnance builder — one cache entry. */
const PICKER_INPUT = {
  status: MedicationStatusFilter.Active,
  page: 1,
  pageSize: MEDICATION_PICKER_LIMIT,
} as const;

type FormControl = Control<PackFormInput, unknown, PackFormValues>;

const toFormValues = (pack?: PrescriptionPackItem): PackFormInput => ({
  name: pack?.name ?? "",
  notes: pack?.notes ?? "",
  items:
    pack?.items.map((item) => ({
      medicationId: item.medicationId,
      posology: item.posology,
      duration: item.duration ?? "",
      remark: item.remark ?? "",
    })) ?? [],
});

/**
 * Create or edit a pack. The item list is saved as a whole: the server
 * replaces the pack's items atomically. A medication deactivated since the
 * pack was built still shows — flagged — and may be kept or removed.
 */
export const PackForm = ({ initialValues, onSuccess, onCancel }: PackFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidatePrescriptions();
  const { data: medications } = useSuspenseQuery(
    trpc.medications.getMany.queryOptions(PICKER_INPUT),
  );

  // Active medications, plus the deactivated ones this pack already holds —
  // so the picker can still name what is selected.
  const inactive = (initialValues?.items ?? [])
    .filter((item) => !item.medication.isActive)
    .map((item) => ({ id: item.medicationId, ...item.medication }));
  const options = [
    ...medications.items,
    ...inactive.filter(
      (item, index) =>
        inactive.findIndex((other) => other.id === item.id) === index,
    ),
  ];
  const inactiveIds = new Set(inactive.map((item) => item.id));

  const form = useForm<PackFormInput, unknown, PackFormValues>({
    resolver: zodResolver(packFormSchema),
    defaultValues: toFormValues(initialValues),
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onDone = (message: string) => async () => {
    await invalidate();
    toast.success(message);
    onSuccess();
  };
  const create = useMutation(
    trpc.prescriptionPacks.create.mutationOptions({
      onSuccess: onDone(COPY.packCreated),
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const update = useMutation(
    trpc.prescriptionPacks.update.mutationOptions({
      onSuccess: onDone(COPY.packUpdated),
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const isPending = create.isPending || update.isPending;

  const onSubmit = (values: PackFormValues) => {
    if (initialValues) update.mutate({ ...values, id: initialValues.id });
    else create.mutate(values);
  };

  const addMedication = (id: string) => {
    const medication = medications.items.find((item) => item.id === id);
    if (!medication || fields.length >= PACK_MAX_ITEMS) return;
    append({
      medicationId: medication.id,
      posology: medication.defaultPosology ?? "",
      duration: medication.defaultDuration ?? "",
      remark: "",
    });
  };

  const medicationOptions = options.map((item) => ({
    id: item.id,
    value: item.id,
    children: <span className="truncate">{formatMedicationLabel(item)}</span>,
  }));

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-h-[70vh] min-w-0 flex-col gap-6 overflow-y-auto px-1"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pack-name">{COPY.packName}</FieldLabel>
              <Input
                {...field}
                id="pack-name"
                autoComplete="off"
                maxLength={PACK_FIELD_MAX.name}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pack-notes">{COPY.packNotes}</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                id="pack-notes"
                rows={2}
                maxLength={PACK_FIELD_MAX.notes}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <FieldSet className="min-w-0 gap-3">
          <FieldLegend variant="label">{COPY.packItems}</FieldLegend>
          <CommandSelect
            value=""
            placeholder={COPY.medicationPlaceholder}
            onSelect={addMedication}
            className="w-full min-w-0"
            options={medications.items.map((item) => ({
              id: item.id,
              value: item.id,
              children: (
                <span className="truncate">{formatMedicationLabel(item)}</span>
              ),
            }))}
          />
          {form.formState.errors.items?.root?.message && (
            <FieldError>{form.formState.errors.items.root.message}</FieldError>
          )}
          {form.formState.errors.items?.message && (
            <FieldError>{form.formState.errors.items.message}</FieldError>
          )}
          <ol className="flex min-w-0 flex-col gap-3">
            {fields.map((field, index) => (
              <PackItemEditor
                key={field.id}
                control={form.control}
                index={index}
                count={fields.length}
                disabled={isPending}
                options={medicationOptions}
                isInactive={inactiveIds.has(field.medicationId)}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
        </FieldSet>
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
          {isPending ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
};

interface PackItemEditorProps {
  control: FormControl;
  index: number;
  count: number;
  disabled: boolean;
  options: { id: string; value: string; children: ReactNode }[];
  isInactive: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}

const PackItemEditor = ({
  control,
  index,
  count,
  disabled,
  options,
  isInactive,
  onMove,
  onRemove,
}: PackItemEditorProps) => (
  <li className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm font-semibold tabular-nums">
          {COPY.lineNumber(index + 1)}
        </span>
        {isInactive && (
          <StatusBadge label={COPY.inactiveMedication} tone="warning" />
        )}
      </div>
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={COPY.moveUp}
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={COPY.moveDown}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={COPY.removeLine}
          disabled={disabled}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>
    </div>

    <Controller
      control={control}
      name={`items.${index}.medicationId`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="min-w-0">
          <FieldLabel>{COPY.label}</FieldLabel>
          <CommandSelect
            value={field.value}
            onSelect={field.onChange}
            options={options}
            className="w-full min-w-0"
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
    <ItemText
      control={control}
      name={`items.${index}.posology`}
      label={COPY.posology}
      maxLength={MEDICATION_FIELD_MAX.posology}
      disabled={disabled}
    />
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <ItemText
        control={control}
        name={`items.${index}.duration`}
        label={COPY.duration}
        maxLength={MEDICATION_FIELD_MAX.duration}
        disabled={disabled}
      />
      <ItemText
        control={control}
        name={`items.${index}.remark`}
        label={COPY.remark}
        maxLength={PACK_FIELD_MAX.remark}
        disabled={disabled}
      />
    </div>
  </li>
);

const ItemText = ({
  control,
  name,
  label,
  maxLength,
  disabled,
}: {
  control: FormControl;
  name: `items.${number}.${"posology" | "duration" | "remark"}`;
  label: string;
  maxLength: number;
  disabled: boolean;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid} className="min-w-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          {...field}
          value={field.value ?? ""}
          id={field.name}
          autoComplete="off"
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          className="h-9"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
