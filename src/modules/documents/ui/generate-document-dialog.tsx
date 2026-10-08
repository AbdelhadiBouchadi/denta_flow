"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import DayFilter from "@/components/shared/day-filter";
import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { clinicNow, toClinicDate } from "@/lib/time";
import type { TreatmentListItem } from "@/modules/treatments/types";
import { useTRPC } from "@/trpc/client";
import { DOCUMENT_COPY as COPY, QUOTE_DEFAULT_VALIDITY_DAYS } from "../constants";
import { useInvalidateDocuments } from "../hooks/use-invalidate-documents";
import { isEligibleForDocument } from "../rules";
import {
  generateInvoiceSchema,
  generateQuoteSchema,
  type GenerateInvoiceValues,
  type GenerateQuoteValues,
} from "../schemas";
import { DocumentType, type GeneratedDocumentType } from "../types";
import { documentPdfUrl } from "../urls";
import ActeSelectionField from "./acte-selection-field";

interface GenerateDocumentDialogProps {
  type: GeneratedDocumentType;
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DIALOG_COPY: Record<
  GeneratedDocumentType,
  { title: string; description: string; empty: string }
> = {
  [DocumentType.Invoice]: {
    title: COPY.invoiceTitle,
    description: COPY.invoiceDescription,
    empty: COPY.noBillable,
  },
  [DocumentType.Quote]: {
    title: COPY.quoteTitle,
    description: COPY.quoteDescription,
    empty: COPY.noPlanned,
  },
};

/** The patient's actes this document type may name — the shared rule. */
export const useEligibleActes = (
  patientId: string,
  type: GeneratedDocumentType,
) => {
  const trpc = useTRPC();
  // Prefetched by the dossier page for the «Actes» tab: no extra request.
  const { data } = useSuspenseQuery(
    trpc.treatments.getManyByPatient.queryOptions({ patientId }),
  );
  return data.items.filter((item) => isEligibleForDocument(type, item.status));
};

/**
 * «Générer une facture» / «Générer un devis». On success the PDF opens in a
 * new tab — the browser's viewer prints it — and the lists refresh.
 * Mounted while open only: each opening starts from «all selected».
 */
const GenerateDocumentDialog = ({
  type,
  patientId,
  open,
  onOpenChange,
}: GenerateDocumentDialogProps) => {
  const copy = DIALOG_COPY[type];
  const items = useEligibleActes(patientId, type);
  const close = () => onOpenChange(false);

  return (
    <ResponsiveDialog
      title={copy.title}
      description={copy.description}
      open={open}
      onOpenChange={onOpenChange}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {copy.empty}
        </p>
      ) : type === DocumentType.Invoice ? (
        <InvoiceForm patientId={patientId} items={items} onDone={close} />
      ) : (
        <QuoteForm patientId={patientId} items={items} onDone={close} />
      )}
    </ResponsiveDialog>
  );
};

interface FormProps {
  patientId: string;
  items: TreatmentListItem[];
  onDone: () => void;
}

/** Opens the new PDF; says so when a popup blocker refused the tab. */
const useOnGenerated = (onDone: () => void) => {
  const invalidate = useInvalidateDocuments();
  return async ({ id }: { id: string }) => {
    const tab = window.open(documentPdfUrl(id, "inline"), "_blank");
    await invalidate();
    if (tab) toast.success(COPY.generated);
    else toast.info(COPY.popupBlocked);
    onDone();
  };
};

const InvoiceForm = ({ patientId, items, onDone }: FormProps) => {
  const trpc = useTRPC();
  const onGenerated = useOnGenerated(onDone);
  const form = useForm<GenerateInvoiceValues>({
    resolver: zodResolver(generateInvoiceSchema),
    defaultValues: { patientId, treatmentIds: items.map((item) => item.id) },
  });
  const generate = useMutation(
    trpc.documents.generateInvoice.mutationOptions({
      onSuccess: onGenerated,
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => generate.mutate(values))}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="treatmentIds"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <ActeSelectionField
                items={items}
                value={field.value}
                onChange={field.onChange}
                disabled={generate.isPending}
                invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <FormActions isPending={generate.isPending} onCancel={onDone} />
    </form>
  );
};

const QuoteForm = ({ patientId, items, onDone }: FormProps) => {
  const trpc = useTRPC();
  const onGenerated = useOnGenerated(onDone);
  const form = useForm<GenerateQuoteValues>({
    resolver: zodResolver(generateQuoteSchema),
    defaultValues: {
      patientId,
      treatmentIds: items.map((item) => item.id),
      // 30 days on the clinic calendar, editable.
      validUntil: toClinicDate(addDays(clinicNow(), QUOTE_DEFAULT_VALIDITY_DAYS)),
    },
  });
  const generate = useMutation(
    trpc.documents.generateQuote.mutationOptions({
      onSuccess: onGenerated,
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => generate.mutate(values))}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="treatmentIds"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <ActeSelectionField
                items={items}
                value={field.value}
                onChange={field.onChange}
                disabled={generate.isPending}
                invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="validUntil"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{COPY.validUntil}</FieldLabel>
              <DayFilter
                label=""
                value={field.value}
                onChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <FormActions isPending={generate.isPending} onCancel={onDone} />
    </form>
  );
};

const FormActions = ({
  isPending,
  onCancel,
}: {
  isPending: boolean;
  onCancel: () => void;
}) => (
  <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
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
      {isPending ? COPY.generating : COPY.generate}
    </Button>
  </div>
);

export default GenerateDocumentDialog;
