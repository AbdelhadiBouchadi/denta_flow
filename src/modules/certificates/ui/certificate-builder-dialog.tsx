"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import DayFilter from "@/components/shared/day-filter";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  CERTIFICATE_BODY_MAX,
  CERTIFICATE_MAX_DAYS,
} from "@/modules/documents/constants";
import { useOnDocumentGenerated } from "@/modules/documents/hooks/use-on-document-generated";
import {
  generateCertificateSchema,
  type GenerateCertificateInput,
  type GenerateCertificateValues,
} from "@/modules/documents/schemas";
import { formatPatientName } from "@/modules/patients/derived";
import type { PatientGetOne } from "@/modules/patients/types";
import { useTRPC } from "@/trpc/client";
import { CERTIFICATE_COPY as COPY } from "../constants";
import {
  buildCertificateValues,
  renderCertificateBody,
  resolveCertificatePeriod,
  usesPeriod,
} from "../variables";
import VariableChips from "./variable-chips";

interface CertificateBuilderDialogProps {
  patient: PatientGetOne;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The Select's value for «no template» — never sent to the server. */
const FREE_TEXT = "__free__";

/**
 * «Nouveau certificat» (prompts/29). The textarea holds the text WITH its
 * {{variables}}; the preview under it resolves them with the very renderer
 * the server runs (certificates/variables.ts). The server renders again,
 * authoritatively, from its own reads: the patient's identity, the date, the
 * number and the practitioner are never taken from this screen.
 */
const CertificateBuilderDialog = ({
  patient,
  open,
  onOpenChange,
}: CertificateBuilderDialogProps) => (
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
        <CertificateBuilderForm
          patient={patient}
          onDone={() => onOpenChange(false)}
        />
      </ErrorBoundary>
    </Suspense>
  </ResponsiveDialog>
);

const CertificateBuilderForm = ({
  patient,
  onDone,
}: {
  patient: PatientGetOne;
  onDone: () => void;
}) => {
  const trpc = useTRPC();
  const onGenerated = useOnDocumentGenerated(onDone);
  const { data: allTemplates } = useSuspenseQuery(
    trpc.certificateTemplates.getMany.queryOptions(),
  );
  const templates = allTemplates.filter((template) => template.isActive);
  const { data: session } = authClient.useSession();
  // The preview's «today»: read once, when the dialog opens.
  const [previewAt] = useState(() => new Date());

  const [first] = templates;
  const form = useForm<
    GenerateCertificateInput,
    unknown,
    GenerateCertificateValues
  >({
    resolver: zodResolver(generateCertificateSchema),
    defaultValues: {
      patientId: patient.id,
      templateKey: first?.key ?? null,
      body: first?.body ?? "",
      startDate: null,
      endDate: null,
      days: null,
      noHeader: false,
    },
  });
  const [body, startDate, endDate, days, templateKey] = useWatch({
    control: form.control,
    name: ["body", "startDate", "endDate", "days", "templateKey"],
  });

  const generate = useMutation(
    trpc.documents.generateCertificate.mutationOptions({
      onSuccess: onGenerated,
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const isPending = generate.isPending;

  // The preview — the same functions the server calls.
  const period = resolveCertificatePeriod({ startDate, endDate, days });
  const preview = period.ok
    ? renderCertificateBody(
        body ?? "",
        buildCertificateValues({
          patient,
          practitionerName: session?.user.name ?? "",
          issuedAt: previewAt,
          period: period.period,
        }),
      )
    : period;
  const showPeriod = usesPeriod(body ?? "");
  const hasRange = Boolean(startDate && endDate);
  const count = preview.ok ? preview.text.length : (body ?? "").length;

  const pickTemplate = (value: string | null) => {
    const template = templates.find((item) => item.key === value);
    const options = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue("templateKey", template?.key ?? null, options);
    if (template) form.setValue("body", template.body, options);
  };

  const templateItems = [
    ...templates.map((template) => ({
      value: template.key,
      label: template.title,
    })),
    { value: FREE_TEXT, label: COPY.freeText },
  ];

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => generate.mutate(values))}
      className="flex max-h-[70vh] min-w-0 flex-col gap-4 overflow-y-auto px-1"
    >
      <div className="bg-muted flex min-w-0 flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <span className="bg-background text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
          {patient.shortCode}
        </span>
        <span className="min-w-0 font-medium wrap-break-word">
          {formatPatientName(patient)}
        </span>
      </div>

      <Field>
        <FieldLabel htmlFor="certificate-template">{COPY.template}</FieldLabel>
        <Select
          value={templateKey ?? FREE_TEXT}
          onValueChange={(value) =>
            pickTemplate(value === FREE_TEXT ? null : value)
          }
          items={templateItems}
          disabled={isPending}
        >
          <SelectTrigger
            id="certificate-template"
            size="default"
            className="h-9 w-full min-w-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templateItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {showPeriod && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Controller
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <DayFilter
                  label={COPY.startDate}
                  value={field.value ?? ""}
                  onChange={(day) => field.onChange(day || null)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DayFilter
                  label={COPY.endDate}
                  value={field.value ?? ""}
                  onChange={(day) => field.onChange(day || null)}
                />
              )}
            />
          </div>
          {form.formState.errors.endDate && (
            <FieldError errors={[form.formState.errors.endDate]} />
          )}

          {hasRange && period.ok && period.period.days !== null ? (
            <p className="text-muted-foreground text-sm">
              {COPY.daysComputed(period.period.days)}
            </p>
          ) : (
            <Controller
              control={form.control}
              name="days"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="max-w-48">
                  <FieldLabel htmlFor="certificate-days">{COPY.days}</FieldLabel>
                  <Input
                    id="certificate-days"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={CERTIFICATE_MAX_DAYS}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                      )
                    }
                    onBlur={field.onBlur}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className="h-9 tabular-nums"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          )}
        </div>
      )}

      <Controller
        control={form.control}
        name="body"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="certificate-body">{COPY.body}</FieldLabel>
            <Textarea
              {...field}
              id="certificate-body"
              rows={8}
              maxLength={CERTIFICATE_BODY_MAX}
              disabled={isPending}
              aria-invalid={fieldState.invalid}
              className="min-h-40 font-mono text-sm"
            />
            <FieldDescription>{COPY.bodyHint}</FieldDescription>
            <VariableChips />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <section className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-label text-muted-foreground uppercase">
            {COPY.preview}
          </h3>
          <span
            className={cn(
              "text-xs tabular-nums",
              count > CERTIFICATE_BODY_MAX
                ? "text-danger-strong"
                : "text-muted-foreground",
            )}
          >
            {COPY.characters(count, CERTIFICATE_BODY_MAX)}
          </span>
        </div>
        {preview.ok ? (
          <p className="bg-muted rounded-lg p-3 text-sm wrap-break-word whitespace-pre-wrap">
            {preview.text}
          </p>
        ) : (
          <p
            role="alert"
            className="border-danger/30 bg-danger-subtle text-danger-strong rounded-lg border p-3 text-sm"
          >
            <span className="font-medium">{COPY.previewError} : </span>
            {preview.error}
          </p>
        )}
      </section>

      <Controller
        control={form.control}
        name="noHeader"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Switch
              id="certificate-no-header"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
            <FieldContent>
              <FieldLabel htmlFor="certificate-no-header">
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
        <Button type="submit" size="lg" disabled={isPending || !preview.ok}>
          {isPending && <Spinner />}
          {isPending ? COPY.generating : COPY.generate}
        </Button>
      </div>
    </form>
  );
};

export default CertificateBuilderDialog;
