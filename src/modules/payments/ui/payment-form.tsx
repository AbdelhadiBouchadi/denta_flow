"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import BalanceAmount from "@/components/shared/balance-amount";
import CommandSelect from "@/components/shared/command-select";
import MoneyInput from "@/components/shared/money-input";
import { TimeField } from "@/components/shared/time-field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
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
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import {
  describeBalance,
  formatCalendarDate,
  formatDH,
} from "@/lib/format";
import { clinicNow, toClinicDate } from "@/lib/time";
import { insurerOptionLabel, selectableInsurers } from "@/modules/insurers/options";
import { formatPatientName } from "@/modules/patients/derived";
import { useTRPC } from "@/trpc/client";
import {
  PAYMENT_COPY as COPY,
  PAYMENT_FIELD_LABELS as L,
  PAYMENT_FIELD_PLACEHOLDERS as P,
  PAYMENT_METHOD_OPTIONS,
} from "../constants";
import {
  toFormValues,
  type PaymentFormDefaults,
  type PaymentPatientOption as PatientOption,
} from "../form-values";
import { useInvalidatePayments } from "../hooks/use-invalidate-payments";
import {
  paymentFormSchema,
  type PaymentFormValues,
  type PaymentValues,
} from "../schemas";
import {
  PaymentMethod,
  type PaymentListItem,
  type PaymentWriteResult,
} from "../types";

/** How many patients the typeahead offers at once. */
const SEARCH_LIMIT = 20;

interface PaymentFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: PaymentListItem;
  /** Create mode only — the dossier's patient. */
  defaultValues?: PaymentFormDefaults;
  /** Create mode only: the patient is shown, not picked. */
  lockPatient?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PatientLabel = ({ patient }: { patient: PatientOption }) => (
  <span className="flex min-w-0 items-center gap-2">
    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
      {patient.shortCode}
    </span>
    <span className="truncate">{formatPatientName(patient)}</span>
  </span>
);

/**
 * «Encaisser». The server decides whether the payment is an advance — from
 * its own SQL, never from this screen — and answers `needs_confirmation`
 * with nothing written; the confirm dialog then resubmits the SAME values
 * with `confirmAdvance`.
 */
export const PaymentForm = ({
  initialValues,
  defaultValues,
  lockPatient = false,
  onSuccess,
  onCancel,
}: PaymentFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateAll = useInvalidatePayments();
  const isEdit = !!initialValues;
  // The patient of an edited payment is immutable; the dossier locks its own.
  const lockedPatient: PatientOption | null = isEdit
    ? initialValues.patient
    : lockPatient
      ? (defaultValues?.patient ?? null)
      : null;

  // Typeahead state of a dialog, not page filter state.
  const [patientSearch, setPatientSearch] = useState("");
  const [pickedPatient, setPickedPatient] = useState<PatientOption | null>(
    lockedPatient ?? defaultValues?.patient ?? null,
  );
  // The version token of the row being edited — moved only by a reload after
  // a CONFLICT, never by a background refetch.
  const [version, setVersion] = useState<Date | undefined>(
    initialValues?.updatedAt,
  );
  // The server's figure for the confirm dialog's sentence.
  const [excessCents, setExcessCents] = useState(0);
  const [AdvanceConfirmation, confirmAdvance] = useConfirm(
    COPY.advanceTitle,
    COPY.advanceDescription(formatDH(excessCents)),
  );

  const form = useForm<PaymentFormValues, unknown, PaymentValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: toFormValues(initialValues, defaultValues),
  });

  const [patientId, method, insurerId] = useWatch({
    control: form.control,
    name: ["patientId", "method", "insurerId"],
  });
  const isInsurance = method === PaymentMethod.Insurance;

  // Options for a dialog, not a page: plain useQuery (04-hydration.md §4 rule 8).
  // Archived patients are included: a debt must stay settleable.
  const { data: patients } = useQuery({
    ...trpc.patients.getMany.queryOptions({
      search: patientSearch,
      pageSize: SEARCH_LIMIT,
      includeArchived: true,
    }),
    enabled: !lockedPatient,
  });
  // The picked patient's balance and insurer — the dossier's own figures.
  const { data: patient } = useQuery({
    ...trpc.patients.getOne.queryOptions({ id: patientId }),
    enabled: !!patientId,
  });
  const { data: patientTreatments } = useQuery({
    ...trpc.treatments.getManyByPatient.queryOptions({ patientId }),
    enabled: !!patientId,
  });
  const { data: insurers } = useQuery(trpc.insurers.getMany.queryOptions());

  const patientOptions: PatientOption[] = [
    ...(pickedPatient &&
    !patients?.items.some((item) => item.id === pickedPatient.id)
      ? [pickedPatient]
      : []),
    ...(patients?.items ?? []),
  ];

  // Billable actes (something owed on them), plus the one already allocated.
  const treatmentOptions = (patientTreatments?.items ?? []).filter(
    (item) =>
      item.amountDueCents > 0 || item.id === initialValues?.treatmentId,
  );

  // Active insurers, plus the one the payment already names.
  const insurerOptions = selectableInsurers(
    insurers?.items ?? [],
    initialValues?.insurerId,
  );

  const handleMethodChange = (next: PaymentMethod) => {
    form.setValue("method", next, { shouldValidate: form.formState.isSubmitted });
    if (next === PaymentMethod.Insurance) {
      // Default: the patient's own insurer, when it is still selectable.
      if (
        !insurerId &&
        patient?.insurerId &&
        insurerOptions.some((option) => option.id === patient.insurerId)
      ) {
        form.setValue("insurerId", patient.insurerId);
      }
      return;
    }
    // Any other method must not carry an insurer.
    form.setValue("insurerId", null);
  };

  const createPayment = useMutation(trpc.payments.create.mutationOptions());
  const updatePayment = useMutation(trpc.payments.update.mutationOptions());
  const isPending = createPayment.isPending || updatePayment.isPending;

  /** Reload the saved version after a CONFLICT — «Rechargez-le». */
  const reloadAfterConflict = async (id: string) => {
    await invalidateAll();
    const fresh = await queryClient
      .fetchQuery(trpc.payments.getOne.queryOptions({ id }))
      .catch(() => null);
    if (!fresh) return;
    setVersion(fresh.updatedAt);
    form.reset(toFormValues(fresh));
  };

  const submit = async (values: PaymentValues, confirmed: boolean) => {
    let result: PaymentWriteResult;
    try {
      result = isEdit
        ? await updatePayment.mutateAsync({
            ...values,
            confirmAdvance: confirmed,
            id: initialValues.id,
            expectedUpdatedAt: version ?? initialValues.updatedAt,
          })
        : await createPayment.mutateAsync({
            ...values,
            confirmAdvance: confirmed,
          });
    } catch (error) {
      toast.error(getErrorMessage(error));
      const code = (error as { data?: { code?: string } | null }).data?.code;
      if (isEdit && code === "CONFLICT") {
        await reloadAfterConflict(initialValues.id);
      }
      return;
    }

    if (result.status === "needs_confirmation") {
      // Nothing was written. Ask, then resend the same values.
      setExcessCents(result.excessCents);
      if (await confirmAdvance()) await submit(values, true);
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
      onSubmit={form.handleSubmit((values) => submit(values, false))}
      noValidate
      // A size container: the rows switch on the FORM's width — the same form
      // sits in a dialog and a phone-width drawer.
      className="@container flex min-h-0 flex-1 flex-col gap-4"
    >
      <AdvanceConfirmation />
      <div className="flex max-h-[70vh] min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4">
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="patientId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.patient}</FieldLabel>
                {lockedPatient ? (
                  <div
                    id={field.name}
                    aria-readonly="true"
                    className="border-input bg-muted/50 flex h-9 w-full min-w-0 items-center rounded-md border px-3 text-sm"
                  >
                    <PatientLabel patient={lockedPatient} />
                  </div>
                ) : (
                  <CommandSelect
                    value={field.value}
                    placeholder={P.patient}
                    onSearch={setPatientSearch}
                    onSelect={(value) => {
                      setPickedPatient(
                        patientOptions.find((p) => p.id === value) ?? null,
                      );
                      field.onChange(value);
                      // An acte and an insurer belong to one patient.
                      if (value !== field.value) {
                        form.setValue("treatmentId", null);
                        if (isInsurance) form.setValue("insurerId", null);
                      }
                    }}
                    options={patientOptions.map((option) => ({
                      id: option.id,
                      value: option.id,
                      children: <PatientLabel patient={option} />,
                    }))}
                    className="w-full min-w-0"
                  />
                )}
                {patient && (
                  // The server's figure, through describeBalance: «Avance»
                  // never reads as a negative amount.
                  <FieldDescription className="flex flex-wrap items-center gap-x-1.5">
                    {COPY.currentBalance}&nbsp;:{" "}
                    {describeBalance(patient.remainingCents).label}
                    <BalanceAmount remainingCents={patient.remainingCents} />
                  </FieldDescription>
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
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

            <Controller
              control={form.control}
              name="method"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.method}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value}
                    onValueChange={(value) =>
                      value && handleMethodChange(value as PaymentMethod)
                    }
                    disabled={isPending}
                    items={PAYMENT_METHOD_OPTIONS}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
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

          {isInsurance && (
            <Controller
              control={form.control}
              name="insurerId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.insurer}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={isPending}
                    items={insurerOptions.map((option) => ({
                      label: insurerOptionLabel(option),
                      value: option.id,
                    }))}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue placeholder={P.insurer} />
                    </SelectTrigger>
                    <SelectContent>
                      {insurerOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {insurerOptionLabel(option)}
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
          )}

          {/* Narrow: the date on its own row, then the time. */}
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-[minmax(0,1fr)_auto] [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="paidDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.paidDate}</FieldLabel>
                  {/* The picker's Dates are only read for their calendar
                      fields; the instant is resolved on the server through
                      the clinic timezone. Future days are not offered. */}
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
              name="paidTime"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.paidTime}</FieldLabel>
                  <TimeField
                    id={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    aria-label={L.paidTime}
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
            name="treatmentId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.treatment}</FieldLabel>
                <Select
                  id={field.name}
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending || !patientId}
                  items={[
                    { label: P.treatment, value: null },
                    ...treatmentOptions.map((item) => ({
                      label: item.label,
                      value: item.id,
                    })),
                  ]}
                >
                  <SelectTrigger
                    size="default"
                    aria-invalid={fieldState.invalid}
                    className="h-9 w-full min-w-0"
                  >
                    {/* shadcn's trigger forces `display: flex` on the
                        value, which cancels its `line-clamp-1` ellipsis: the
                        label truncates in its own span instead. */}
                    <SelectValue>
                      {(value: string | null) => {
                        const label =
                          treatmentOptions.find((item) => item.id === value)
                            ?.label ?? P.treatment;
                        return (
                          <span title={label} className="min-w-0 truncate">
                            {label}
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{P.treatment}</SelectItem>
                    {treatmentOptions.map((item) => (
                      // The ui ItemText is `shrink-0` with no `min-w-0`, so a
                      // long label overflowed the anchor-wide popup and was
                      // clipped. Letting that first child shrink lets the
                      // label truncate while the remainder stays visible.
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        title={item.label}
                        className="[&>:first-child]:min-w-0 [&>:first-child]:shrink"
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        {/* The acte's allocated remainder, from SQL. */}
                        <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs">
                          {describeBalance(item.remainingCents).kind === "due"
                            ? COPY.treatmentRemaining
                            : null}
                          <BalanceAmount
                            remainingCents={item.remainingCents}
                            showCreditLabel
                            className="font-normal"
                          />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {patientId && treatmentOptions.length === 0 && (
                  <FieldDescription>{COPY.noTreatmentFound}</FieldDescription>
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="reference"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.reference}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  autoComplete="off"
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={P.reference}
                  className="h-9"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

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
