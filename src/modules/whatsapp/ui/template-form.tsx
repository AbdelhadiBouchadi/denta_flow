"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { FlaskConicalIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  DEFAULT_BODIES,
  EVENT_OPTIONS,
  TEMPLATE_BODY_MAX,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import {
  templateFormSchema,
  type TemplateFormValues,
  type TemplateValues,
} from "../schemas";
import { canonicalLength, isPromotional } from "../template-body";
import { WhatsappEvent, type WhatsappTemplateItem } from "../types";
import { MessageEditor } from "./message-editor";
import { MessagePreview } from "./message-preview";

interface TemplateFormProps {
  /** Present ⇒ edit mode (06-ui.md §5). */
  initialValues?: WhatsappTemplateItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (template?: WhatsappTemplateItem): TemplateFormValues => ({
  name: template?.name ?? "",
  kind: template?.kind ?? WhatsappEvent.Reminder,
  segments: template?.segments ?? DEFAULT_BODIES[WhatsappEvent.Reminder],
  isActive: template?.isActive ?? true,
});

/**
 * One form, two modes: «Nouveau modèle» and «Modifier le modèle»
 * (prompts/33b, decisions 5 and 6). The message is edited with tags, the
 * patient's view is previewed live, and — with a real sender — the template
 * is saved as a draft or saved AND sent for WhatsApp approval. In test mode
 * the text is used as is; without a connection it stays a draft.
 */
export const TemplateForm = ({ initialValues, onSuccess, onCancel }: TemplateFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const { data: status } = useSuspenseQuery(trpc.whatsapp.getServiceStatus.queryOptions());
  const { data: templates } = useSuspenseQuery(trpc.whatsapp.getTemplates.queryOptions());
  const isEdit = !!initialValues;
  const canSubmit = status.templateSubmission === "available";
  // Bumped to rebuild the editor when the kind swaps in another default text.
  const [editorKey, setEditorKey] = useState(0);
  const [submitIntent, setSubmitIntent] = useState(false);

  const form = useForm<TemplateFormValues, unknown, TemplateValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: toFormValues(initialValues),
  });
  const segments = useWatch({ control: form.control, name: "segments" });

  const callbacks = {
    onSuccess: async () => {
      await invalidate();
      toast.success(submitIntent ? COPY.templateSubmitted : COPY.templateSaved);
      onSuccess?.();
    },
    onError: async (error: { message: string }) => {
      // A failed submission still saved the text as a draft: show it.
      await invalidate();
      toast.error(error.message);
    },
  };
  const create = useMutation(trpc.whatsapp.createTemplate.mutationOptions(callbacks));
  const update = useMutation(trpc.whatsapp.updateTemplate.mutationOptions(callbacks));
  const isPending = create.isPending || update.isPending;

  const save = (submit: boolean) =>
    form.handleSubmit((values) => {
      setSubmitIntent(submit);
      if (isEdit) update.mutate({ ...values, id: initialValues.id, submit });
      else create.mutate({ ...values, submit });
    });

  const length = canonicalLength(segments ?? []);
  const promotional = isPromotional(segments ?? []);
  const textChanged = !!form.formState.dirtyFields.segments;

  return (
    <form
      noValidate
      onSubmit={(event) => void save(canSubmit)(event)}
      className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-1"
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
              <FieldDescription>{COPY.templateNameHelp}</FieldDescription>
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
                onValueChange={(value) => {
                  const kind = value as WhatsappEvent;
                  field.onChange(kind);
                  // An untouched new template follows its event's default text.
                  if (!isEdit && !form.getFieldState("segments").isDirty) {
                    form.setValue("segments", DEFAULT_BODIES[kind]);
                    setEditorKey((key) => key + 1);
                  }
                  void form.trigger("segments");
                }}
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

      <Controller
        control={form.control}
        name="segments"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id="template-body-label" htmlFor="template-body">
              {COPY.templateBody}
            </FieldLabel>
            <MessageEditor
              key={editorKey}
              id="template-body"
              value={field.value}
              // Validated as it is typed: the WhatsApp rules show before saving.
              onChange={(next) =>
                form.setValue("segments", next, { shouldDirty: true, shouldValidate: true })
              }
              onBlur={field.onBlur}
              disabled={isPending}
              invalid={fieldState.invalid}
              aria-labelledby="template-body-label"
              aria-describedby="template-body-help"
            />
            <div
              id="template-body-help"
              className="text-muted-foreground flex flex-wrap justify-between gap-x-3 text-xs"
            >
              <span>{COPY.templateBodyHelp}</span>
              <span
                className={cn("tabular-nums", length > TEMPLATE_BODY_MAX && "text-danger-strong")}
              >
                {COPY.bodyLength(length, TEMPLATE_BODY_MAX)}
              </span>
            </div>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {promotional && (
        <Alert className="border-warning/40 bg-warning-subtle">
          <TriangleAlertIcon />
          <AlertDescription className="text-warning-strong">
            {COPY.promotionalWarning}
          </AlertDescription>
        </Alert>
      )}

      <MessagePreview segments={segments ?? []} values={templates.preview} />

      {status.templateSubmission === "sandbox" && (
        <Alert>
          <FlaskConicalIcon />
          <AlertDescription>{COPY.templatesTestMode}</AlertDescription>
        </Alert>
      )}
      {status.templateSubmission === "unavailable" && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{COPY.templatesNotConnected}</AlertDescription>
        </Alert>
      )}
      {canSubmit && isEdit && initialValues.hasApprovedVersion && textChanged && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{COPY.previousVersionActive}</AlertDescription>
        </Alert>
      )}

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

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        {canSubmit && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={(event) => void save(false)(event)}
          >
            {isPending && !submitIntent ? (
              <>
                <Spinner />
                {COPY.saving}
              </>
            ) : (
              COPY.saveAsDraft
            )}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isPending} className="h-auto min-h-10 whitespace-normal">
          {isPending && (submitIntent || !canSubmit) ? (
            <>
              <Spinner />
              {canSubmit ? COPY.submitting : COPY.saving}
            </>
          ) : canSubmit ? (
            COPY.saveAndSubmit
          ) : (
            COPY.save
          )}
        </Button>
      </div>
    </form>
  );
};
