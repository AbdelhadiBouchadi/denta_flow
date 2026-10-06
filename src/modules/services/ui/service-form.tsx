"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { InfoIcon, ScanLineIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import MoneyInput from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
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
import { formatDH } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  formatNgapCotation,
  NGAP_COPY,
  NGAP_XRAY_LABELS,
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_CODE_MAX,
  SERVICE_COPY,
  SERVICE_DEFAULT_DURATION,
  SERVICE_DURATION_MAX,
  SERVICE_DURATION_MIN,
  SERVICE_FIELD_LABELS,
  SERVICE_FIELD_PLACEHOLDERS,
} from "../constants";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useInvalidateServices } from "../hooks/use-invalidate-services";
import {
  serviceFormSchema,
  type ServiceFormValues,
  type ServiceValues,
} from "../schemas";
import type { NgapSearchItem, ServiceListItem } from "../types";
import { NgapActPicker } from "./ngap-act-picker";

interface ServiceFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: ServiceListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (service?: ServiceListItem): ServiceFormValues => ({
  label: service?.label ?? "",
  // No category preselected on create: picking one is a decision.
  category: service?.category as ServiceFormValues["category"],
  // NaN is «empty» for the two number fields; the schema rejects it in French.
  defaultPriceCents: service?.defaultPriceCents ?? Number.NaN,
  durationMinutes: service?.durationMinutes ?? SERVICE_DEFAULT_DURATION,
  nomenclatureCode: service?.nomenclatureCode ?? "",
});

const fromNumberInput = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

export const ServiceForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: ServiceFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateServices();
  const isEdit = !!initialValues;

  const form = useForm<ServiceFormValues, unknown, ServiceValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: toFormValues(initialValues),
  });

  // The NGAP details follow whatever code is in the field — picked, typed or
  // loaded on edit — through the same procedure the picker uses.
  const code = useWatch({ control: form.control, name: "nomenclatureCode" });
  const debouncedCode = useDebouncedValue((code ?? "").trim());
  const { data: codeMatches } = useQuery({
    ...trpc.services.searchNgap.queryOptions({
      query: debouncedCode,
      limit: 5,
    }),
    enabled: debouncedCode.length > 0,
    placeholderData: keepPreviousData,
  });
  const ngapAct: NgapSearchItem | null =
    debouncedCode.length > 0
      ? (codeMatches?.items.find((act) => act.code === debouncedCode) ?? null)
      : null;

  const createService = useMutation(
    trpc.services.create.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(SERVICE_COPY.created);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateService = useMutation(
    trpc.services.update.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(SERVICE_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createService.isPending || updateService.isPending;

  const onSubmit = (values: ServiceValues) => {
    if (isEdit) {
      updateService.mutate({ id: initialValues.id, ...values });
      return;
    }
    createService.mutate(values);
  };

  const applyNgapAct = (act: NgapSearchItem) => {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue("label", act.designation, options);
    form.setValue("category", act.suggestedCategory, options);
    form.setValue("nomenclatureCode", act.code, options);
    // On create the reference tariff is the editable starting value. On edit
    // it is only ever a hint: the clinic's fee is never silently replaced.
    if (!isEdit && !act.onQuote) {
      form.setValue("defaultPriceCents", act.referenceTariffCents, options);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="ngap-picker">
            {SERVICE_FIELD_LABELS.ngapPicker}
          </FieldLabel>
          <NgapActPicker
            id="ngap-picker"
            disabled={isPending}
            onPick={applyNgapAct}
          />
        </Field>

        <Controller
          control={form.control}
          name="label"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {SERVICE_FIELD_LABELS.label}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={SERVICE_FIELD_PLACEHOLDERS.label}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="category"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {SERVICE_FIELD_LABELS.category}
                </FieldLabel>
                <Select
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value ?? undefined)}
                  items={SERVICE_CATEGORY_OPTIONS}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id={field.name}
                    size="default"
                    className="h-9 w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue
                      placeholder={SERVICE_FIELD_PLACEHOLDERS.category}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORY_OPTIONS.map((option) => (
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
            name="nomenclatureCode"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {SERVICE_FIELD_LABELS.nomenclatureCode}
                </FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={field.name}
                  autoComplete="off"
                  maxLength={SERVICE_CODE_MAX}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={SERVICE_FIELD_PLACEHOLDERS.nomenclatureCode}
                  className="h-9 font-mono"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {ngapAct && (
          <div className="bg-muted flex flex-col gap-1 rounded-lg p-3 text-sm">
            <span className="text-foreground-secondary">
              <span className="font-mono">{ngapAct.code}</span> ·{" "}
              {ngapAct.chapter} ·{" "}
              <span className="tabular-nums">
                {formatNgapCotation(ngapAct.letter, ngapAct.coefficient)}
              </span>
            </span>
            {ngapAct.xrayRequired && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ScanLineIcon aria-hidden="true" className="size-3.5 shrink-0" />
                {NGAP_XRAY_LABELS[ngapAct.xrayRequired]}
              </span>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="defaultPriceCents"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {SERVICE_FIELD_LABELS.defaultPriceCents}
                </FieldLabel>
                <MoneyInput
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  value={Number.isNaN(field.value) ? null : field.value}
                  onChange={(cents) => field.onChange(cents ?? Number.NaN)}
                  onBlur={field.onBlur}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                />
                {ngapAct && (
                  <FieldDescription className="tabular-nums">
                    {isEdit
                      ? `${NGAP_COPY.referenceTariffHint} `
                      : `${NGAP_COPY.referenceTariff} : `}
                    {ngapAct.onQuote
                      ? NGAP_COPY.onQuote
                      : formatDH(ngapAct.referenceTariffCents)}
                  </FieldDescription>
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="durationMinutes"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {SERVICE_FIELD_LABELS.durationMinutes}
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  type="number"
                  inputMode="numeric"
                  min={SERVICE_DURATION_MIN}
                  max={SERVICE_DURATION_MAX}
                  step={5}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(event) =>
                    field.onChange(fromNumberInput(event.target.value))
                  }
                  onBlur={field.onBlur}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  className="h-9 tabular-nums"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {isEdit && (
          <p className="bg-muted text-foreground-secondary flex gap-2 rounded-lg p-3 text-sm">
            <InfoIcon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            {SERVICE_COPY.priceUnchangedInfo}
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
            {SERVICE_COPY.cancel}
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
              aria-label={isEdit ? SERVICE_COPY.updating : SERVICE_COPY.saving}
            />
          )}
          {isPending
            ? isEdit
              ? SERVICE_COPY.updating
              : SERVICE_COPY.saving
            : isEdit
              ? SERVICE_COPY.update
              : SERVICE_COPY.save}
        </Button>
      </div>
    </form>
  );
};
