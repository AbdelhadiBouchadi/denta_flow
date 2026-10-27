"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
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
import { useTRPC } from "@/trpc/client";
import {
  DEFAULT_MANUAL_TEXTS,
  EVENT_OPTIONS,
  MESSAGE_VARIABLES,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import { renderManualText, SAMPLE_PARAMS } from "../message";
import {
  templateFormSchema,
  type TemplateFormValues,
  type TemplateValues,
} from "../schemas";
import { WhatsappEvent, type WhatsappTemplateItem } from "../types";

interface TemplateFormProps {
  /** Present ⇒ edit mode (06-ui.md §5). */
  initialValues?: WhatsappTemplateItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (template?: WhatsappTemplateItem): TemplateFormValues => ({
  name: template?.name ?? "",
  kind: template?.kind ?? WhatsappEvent.Reminder,
  contentSid: template?.contentSid ?? "",
  language: template?.language ?? "fr",
  manualText: template?.manualText ?? DEFAULT_MANUAL_TEXTS[WhatsappEvent.Reminder],
  isActive: template?.isActive ?? true,
});

/** One form, two modes: «Nouveau modèle» and «Modifier le modèle». */
export const TemplateForm = ({ initialValues, onSuccess, onCancel }: TemplateFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEdit = !!initialValues;

  const form = useForm<TemplateFormValues, unknown, TemplateValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: toFormValues(initialValues),
  });
  const manualText = useWatch({ control: form.control, name: "manualText" });

  const mutationCallbacks = {
    onSuccess: async () => {
      await invalidate();
      toast.success(COPY.templateSaved);
      onSuccess?.();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const create = useMutation(trpc.whatsapp.createTemplate.mutationOptions(mutationCallbacks));
  const update = useMutation(trpc.whatsapp.updateTemplate.mutationOptions(mutationCallbacks));
  const isPending = create.isPending || update.isPending;

  const onSubmit = (values: TemplateValues) => {
    if (isEdit) update.mutate({ ...values, id: initialValues.id });
    else create.mutate(values);
  };

  /** Inserts a variable at the caret, and puts the caret after it. */
  const insertToken = (token: string) => {
    const element = textareaRef.current;
    const current = form.getValues("manualText");
    const start = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    form.setValue("manualText", next, { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-name">{COPY.templateName}</FieldLabel>
              <Input
                {...field}
                id="template-name"
                placeholder={COPY.templateNamePlaceholder}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="kind"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-kind">{COPY.templateKind}</FieldLabel>
              <Select
                id="template-kind"
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                items={EVENT_OPTIONS}
                // A rule uses it: its event cannot change (the server agrees).
                disabled={isPending || !!initialValues?.isUsed}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Controller
          control={form.control}
          name="contentSid"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-sid">{COPY.templateSid}</FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                id="template-sid"
                placeholder={COPY.templateSidPlaceholder}
                className="font-mono text-xs"
                spellCheck={false}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              <FieldDescription>{COPY.templateSidHelp}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="language"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="template-language">{COPY.templateLanguage}</FieldLabel>
              <Input
                {...field}
                id="template-language"
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <Controller
        control={form.control}
        name="manualText"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="template-manual-text">{COPY.templateManualText}</FieldLabel>
            <div className="flex flex-wrap gap-1.5" aria-label={COPY.variables} role="group">
              {MESSAGE_VARIABLES.map((variable) => (
                <Button
                  key={variable.token}
                  type="button"
                  size="xs"
                  variant="outline"
                  className="rounded-full font-mono"
                  title={variable.label}
                  disabled={isPending}
                  onClick={() => insertToken(variable.token)}
                >
                  {variable.token}
                </Button>
              ))}
            </div>
            <Textarea
              {...field}
              ref={(element) => {
                field.ref(element);
                textareaRef.current = element;
              }}
              id="template-manual-text"
              rows={4}
              aria-invalid={fieldState.invalid}
              disabled={isPending}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
              <span className="text-muted-foreground text-xs">{COPY.preview}</span>
              <p className="text-foreground whitespace-pre-wrap">
                {renderManualText(manualText ?? "", SAMPLE_PARAMS)}
              </p>
            </div>
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
              onCheckedChange={(checked) => field.onChange(checked)}
              disabled={isPending}
            />
            <FieldLabel htmlFor="template-active">{COPY.templateActive}</FieldLabel>
          </Field>
        )}
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner />
              {COPY.saving}
            </>
          ) : (
            COPY.save
          )}
        </Button>
      </div>
    </form>
  );
};
