"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { CERTIFICATE_BODY_MAX } from "@/modules/documents/constants";
import { useTRPC } from "@/trpc/client";
import {
  CERTIFICATE_COPY as COPY,
  CERTIFICATE_TEMPLATE_TITLE_MAX,
} from "../constants";
import { useInvalidateCertificateTemplates } from "../hooks/use-invalidate-certificate-templates";
import {
  certificateTemplateFormSchema,
  type CertificateTemplateFormValues,
} from "../schemas";
import type { CertificateTemplateItem } from "../types";
import VariableChips from "./variable-chips";

interface TemplateFormProps {
  template: CertificateTemplateItem;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Edit a template's title, text and visibility. An unknown {{variable}} is
 * refused by the shared schema, in French, naming it. The save carries the
 * row's `updatedAt`: two editors never silently overwrite each other.
 */
export const TemplateForm = ({ template, onSuccess, onCancel }: TemplateFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateCertificateTemplates();
  const form = useForm<CertificateTemplateFormValues>({
    resolver: zodResolver(certificateTemplateFormSchema),
    defaultValues: {
      title: template.title,
      body: template.body,
      isActive: template.isActive,
    },
  });
  const update = useMutation(
    trpc.certificateTemplates.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.saved);
        onSuccess();
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidate();
      },
    }),
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        update.mutate({
          ...values,
          id: template.id,
          expectedUpdatedAt: template.updatedAt,
        }),
      )}
      className="flex max-h-[70vh] min-w-0 flex-col gap-6 overflow-y-auto px-1"
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-title">{COPY.title}</FieldLabel>
              <Input
                {...field}
                id="template-title"
                autoComplete="off"
                maxLength={CERTIFICATE_TEMPLATE_TITLE_MAX}
                disabled={update.isPending}
                aria-invalid={fieldState.invalid}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="body"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-body">{COPY.bodyLabel}</FieldLabel>
              <Textarea
                {...field}
                id="template-body"
                rows={10}
                maxLength={CERTIFICATE_BODY_MAX}
                disabled={update.isPending}
                aria-invalid={fieldState.invalid}
                className="min-h-48 font-mono text-sm"
              />
              <VariableChips />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id="template-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={update.isPending}
              />
              <FieldContent>
                <FieldLabel htmlFor="template-active">{COPY.active}</FieldLabel>
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={update.isPending}
          onClick={onCancel}
        >
          {COPY.cancel}
        </Button>
        <Button type="submit" size="lg" disabled={update.isPending}>
          {update.isPending && <Spinner />}
          {update.isPending ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
};
