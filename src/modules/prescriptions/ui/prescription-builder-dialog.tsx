"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { toast } from "sonner";

import CommandSelect from "@/components/shared/command-select";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import ResponsiveDialog from "@/components/shared/responsive-dialog";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/errors";
import {
  PRESCRIPTION_FIELD_MAX,
  PRESCRIPTION_MAX_LINES,
} from "@/modules/documents/constants";
import { useOnDocumentGenerated } from "@/modules/documents/hooks/use-on-document-generated";
import {
  generatePrescriptionSchema,
  type GeneratePrescriptionInput,
  type GeneratePrescriptionValues,
} from "@/modules/documents/schemas";
import { formatPatientName } from "@/modules/patients/derived";
import type { PatientGetOne } from "@/modules/patients/types";
import { useTRPC } from "@/trpc/client";
import {
  MEDICATION_PICKER_LIMIT,
  PRESCRIPTION_COPY as COPY,
} from "../constants";
import { formatMedicationLabel } from "../normalize";
import { MedicationStatusFilter } from "../types";

interface PrescriptionBuilderDialogProps {
  patient: PatientGetOne;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The picker's query — one large page of ACTIVE medications. */
const PICKER_INPUT = {
  status: MedicationStatusFilter.Active,
  page: 1,
  pageSize: MEDICATION_PICKER_LIMIT,
} as const;

/**
 * «Nouvelle ordonnance» (prompts/29). Mounted while open only, so each
 * opening starts empty. The catalogue loads when the dialog opens — a dossier
 * visit does not pay for it — inside the dialog's own Suspense boundary.
 *
 * Nothing here judges a prescription: the patient's allergies are shown, as
 * written, and that is the only safety feature (decision 7).
 */
const PrescriptionBuilderDialog = ({
  patient,
  open,
  onOpenChange,
}: PrescriptionBuilderDialogProps) => (
  <ResponsiveDialog
    title={COPY.builderTitle}
    description={COPY.builderDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <Suspense
      fallback={
        <LoadingState
          title={COPY.loadingTitle}
          description={COPY.loadingDescription}
        />
      }
    >
      <ErrorBoundary
        fallback={
          <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
        }
      >
        <PrescriptionBuilderForm
          patient={patient}
          onDone={() => onOpenChange(false)}
        />
      </ErrorBoundary>
    </Suspense>
  </ResponsiveDialog>
);

type Line = GeneratePrescriptionInput["lines"][number];

const emptyLine = (): Line => ({
  medicationId: null,
  label: "",
  strength: "",
  posology: "",
  duration: "",
  remark: "",
});

/** A line the server would accept as a start: a name and a posology. */
const isStarted = (line: Line | undefined) =>
  Boolean(line?.label?.trim() && line.posology?.trim());

const PrescriptionBuilderForm = ({
  patient,
  onDone,
}: {
  patient: PatientGetOne;
  onDone: () => void;
}) => {
  const trpc = useTRPC();
  const onGenerated = useOnDocumentGenerated(onDone);
  const { data: medications } = useSuspenseQuery(
    trpc.medications.getMany.queryOptions(PICKER_INPUT),
  );
  const { data: packs } = useSuspenseQuery(
    trpc.prescriptionPacks.getMany.queryOptions(),
  );
  const activeIds = new Set(medications.items.map((item) => item.id));

  const form = useForm<
    GeneratePrescriptionInput,
    unknown,
    GeneratePrescriptionValues
  >({
    resolver: zodResolver(generatePrescriptionSchema),
    defaultValues: { patientId: patient.id, lines: [], noHeader: false },
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const lines = useWatch({ control: form.control, name: "lines" });
  const hasValidLine = (lines ?? []).some(isStarted);

  // On a server error the dialog stays open and the form keeps every line.
  const generate = useMutation(
    trpc.documents.generatePrescription.mutationOptions({
      onSuccess: onGenerated,
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const isPending = generate.isPending;
  const remaining = PRESCRIPTION_MAX_LINES - fields.length;

  const addMedication = (id: string) => {
    const medication = medications.items.find((item) => item.id === id);
    if (!medication) return;
    if (remaining < 1) {
      toast.error(COPY.packTooLong);
      return;
    }
    append({
      medicationId: medication.id,
      label: medication.name,
      strength: medication.strength ?? "",
      posology: medication.defaultPosology ?? "",
      duration: medication.defaultDuration ?? "",
      remark: "",
    });
  };

  const addPack = (id: string) => {
    const pack = packs.find((item) => item.id === id);
    if (!pack) return;
    if (pack.items.length > remaining) {
      toast.error(COPY.packTooLong);
      return;
    }
    append(
      pack.items.map((item) => ({
        medicationId: item.medicationId,
        label: item.medication.name,
        strength: item.medication.strength ?? "",
        posology: item.posology,
        duration: item.duration ?? "",
        remark: item.remark ?? "",
      })),
    );
    toast.success(COPY.packAdded(pack.name, pack.items.length));
  };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => generate.mutate(values))}
      className="flex max-h-[70vh] min-w-0 flex-col gap-4 overflow-y-auto px-1"
    >
      {/* The patient is locked: the dialog is opened from their dossier. */}
      <div className="bg-muted flex min-w-0 flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <span className="bg-background text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
          {patient.shortCode}
        </span>
        <span className="min-w-0 font-medium wrap-break-word">
          {formatPatientName(patient)}
        </span>
      </div>

      {patient.allergies?.trim() && (
        <div
          role="note"
          className="border-danger/30 bg-danger-subtle text-danger-strong flex min-w-0 gap-2 rounded-lg border p-3"
        >
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-label uppercase">{COPY.allergiesTitle}</span>
            <p className="text-sm wrap-break-word whitespace-pre-wrap">
              {patient.allergies}
            </p>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <CommandSelect
          value=""
          placeholder={COPY.medicationPlaceholder}
          onSelect={addMedication}
          className="w-full min-w-0"
          options={medications.items.map((item) => ({
            id: item.id,
            value: item.id,
            children: (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{formatMedicationLabel(item)}</span>
                <span className="text-muted-foreground text-xs">{item.form}</span>
              </span>
            ),
          }))}
        />
        <CommandSelect
          value=""
          placeholder={COPY.packPlaceholder}
          onSelect={addPack}
          className="w-full min-w-0"
          options={packs.map((pack) => ({
            id: pack.id,
            value: pack.id,
            children: (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{pack.name}</span>
                <span className="text-muted-foreground text-xs">
                  {COPY.packItemCount(pack.items.length)}
                </span>
              </span>
            ),
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || remaining < 1}
          onClick={() => append(emptyLine())}
        >
          <PlusIcon />
          {COPY.addFreeLine}
        </Button>
        <span
          aria-live="polite"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {COPY.lineCount(fields.length)}
        </span>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
          {COPY.noLines}
        </p>
      ) : (
        <ol className="flex min-w-0 flex-col gap-3">
          {fields.map((field, index) => (
            <LineEditor
              key={field.id}
              control={form.control}
              index={index}
              count={fields.length}
              disabled={isPending}
              isInactive={Boolean(
                field.medicationId && !activeIds.has(field.medicationId),
              )}
              onMove={(to) => move(index, to)}
              onRemove={() => remove(index)}
            />
          ))}
        </ol>
      )}

      {form.formState.errors.lines?.root?.message && (
        <FieldError>{form.formState.errors.lines.root.message}</FieldError>
      )}

      <Controller
        control={form.control}
        name="noHeader"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Switch
              id="prescription-no-header"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
            <FieldContent>
              <FieldLabel htmlFor="prescription-no-header">
                {COPY.noHeader}
              </FieldLabel>
              <FieldDescription>{COPY.noHeaderHint}</FieldDescription>
            </FieldContent>
          </Field>
        )}
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={onDone}
        >
          {COPY.cancel}
        </Button>
        <Button type="submit" size="lg" disabled={isPending || !hasValidLine}>
          {isPending && <Spinner />}
          {isPending ? COPY.generating : COPY.generate}
        </Button>
      </div>
    </form>
  );
};

interface LineEditorProps {
  control: Control<GeneratePrescriptionInput, unknown, GeneratePrescriptionValues>;
  index: number;
  count: number;
  disabled: boolean;
  isInactive: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** One numbered line: every field editable, reorderable, removable. */
const LineEditor = ({
  control,
  index,
  count,
  disabled,
  isInactive,
  onMove,
  onRemove,
}: LineEditorProps) => {
  const name = (key: Exclude<keyof Line, "medicationId">) =>
    `lines.${index}.${key}` as const;

  return (
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

      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField
          control={control}
          name={name("label")}
          label={COPY.label}
          maxLength={PRESCRIPTION_FIELD_MAX.label}
          disabled={disabled}
        />
        <TextField
          control={control}
          name={name("strength")}
          label={COPY.strength}
          maxLength={PRESCRIPTION_FIELD_MAX.strength}
          disabled={disabled}
        />
      </div>
      <TextField
        control={control}
        name={name("posology")}
        label={COPY.posology}
        placeholder={COPY.posologyPlaceholder}
        maxLength={PRESCRIPTION_FIELD_MAX.posology}
        disabled={disabled}
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TextField
          control={control}
          name={name("duration")}
          label={COPY.duration}
          placeholder={COPY.durationPlaceholder}
          maxLength={PRESCRIPTION_FIELD_MAX.duration}
          disabled={disabled}
        />
        <TextField
          control={control}
          name={name("remark")}
          label={COPY.remark}
          maxLength={PRESCRIPTION_FIELD_MAX.remark}
          disabled={disabled}
        />
      </div>
    </li>
  );
};

const TextField = ({
  control,
  name,
  label,
  placeholder,
  maxLength,
  disabled,
}: {
  control: LineEditorProps["control"];
  name: `lines.${number}.${"label" | "strength" | "posology" | "duration" | "remark"}`;
  label: string;
  placeholder?: string;
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
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          className="h-9"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);

export default PrescriptionBuilderDialog;
