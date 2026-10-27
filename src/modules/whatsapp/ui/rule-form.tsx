"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
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
import { useTRPC } from "@/trpc/client";
import {
  EVENT_LABELS,
  MAX_REMINDER_RULES,
  TIMING_UNITS,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import { splitOffset } from "../rules";
import { ruleFormSchema, type RuleFormValues } from "../schemas";
import { WhatsappEvent, type WhatsappRuleItem } from "../types";

interface RuleFormProps {
  /** Present ⇒ edit mode. */
  initialValues?: WhatsappRuleItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const UNIT_ITEMS = TIMING_UNITS.map((unit) => ({ value: unit.value, label: unit.label }));

/**
 * «Ajouter une règle» / edit. The template is chosen first and fixes the
 * event; only the templates decision 2 still allows are offered (at most 3
 * reminders, one rule per other event). The server enforces the same rules.
 */
export const RuleForm = ({ initialValues, onSuccess, onCancel }: RuleFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const { data: templates } = useSuspenseQuery(trpc.whatsapp.getTemplates.queryOptions());
  const { data: rules } = useSuspenseQuery(trpc.whatsapp.listRules.queryOptions());
  const isEdit = !!initialValues;

  const others = rules.items.filter((rule) => rule.id !== initialValues?.id);
  const allowed = templates.items.filter((template) => {
    if (!template.isActive && template.id !== initialValues?.template.id) return false;
    const sameEvent = others.filter((rule) => rule.event === template.kind);
    return template.kind === WhatsappEvent.Reminder
      ? sameEvent.length < MAX_REMINDER_RULES
      : sameEvent.length === 0;
  });
  const templateItems = allowed.map((template) => ({
    value: template.id,
    label: `${template.name} — ${EVENT_LABELS[template.kind]}`,
  }));

  const initialTiming = splitOffset(initialValues?.offsetMinutes ?? 24 * 60);
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      templateId: initialValues?.template.id ?? "",
      event: initialValues?.event ?? allowed[0]?.kind ?? WhatsappEvent.Reminder,
      value: initialValues ? initialTiming.value : 24,
      unit: initialValues ? initialTiming.unit : "hours",
      enabled: initialValues?.enabled ?? true,
    },
  });
  const event = useWatch({ control: form.control, name: "event" });

  const callbacks = {
    onSuccess: async () => {
      await invalidate();
      toast.success(COPY.ruleSaved);
      onSuccess?.();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const create = useMutation(trpc.whatsapp.createRule.mutationOptions(callbacks));
  const update = useMutation(trpc.whatsapp.updateRule.mutationOptions(callbacks));
  const isPending = create.isPending || update.isPending;

  if (templateItems.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{COPY.noTemplateAvailable}</p>;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) => {
        if (isEdit) update.mutate({ ...values, id: initialValues.id });
        else create.mutate(values);
      })}
    >
      <Controller
        control={form.control}
        name="templateId"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="rule-template">{COPY.ruleTemplate}</FieldLabel>
            <Select
              id="rule-template"
              value={field.value || null}
              onValueChange={(value) => {
                field.onChange(value ?? "");
                const template = allowed.find((entry) => entry.id === value);
                if (template) {
                  form.setValue("event", template.kind, { shouldValidate: false });
                  // A sensible start for the newly fixed event.
                  if (template.kind === WhatsappEvent.Reminder) {
                    form.setValue("value", 24);
                    form.setValue("unit", "hours");
                  } else {
                    form.setValue("value", 0);
                    form.setValue("unit", "minutes");
                  }
                }
              }}
              items={templateItems}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={COPY.ruleTemplate} />
              </SelectTrigger>
              <SelectContent>
                {templateItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{COPY.ruleDialogDescription}</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Field>
        <FieldLabel htmlFor="rule-value">{COPY.ruleTiming}</FieldLabel>
        <div className="flex flex-wrap items-start gap-2">
          <Controller
            control={form.control}
            name="value"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1">
                <Input
                  id="rule-value"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="w-24 tabular-nums"
                  aria-label={COPY.ruleValue}
                  aria-invalid={fieldState.invalid}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(change) => field.onChange(change.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  disabled={isPending}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="unit"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                items={UNIT_ITEMS}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 w-32" aria-label={COPY.ruleUnit}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_ITEMS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {/* The direction is fixed by the event, never chosen. */}
          <span className="bg-muted text-foreground flex h-9 items-center rounded-lg px-3 text-sm font-medium">
            {event === WhatsappEvent.Reminder ? COPY.before : COPY.after}
          </span>
        </div>
        {form.formState.errors.value && (
          <FieldError errors={[form.formState.errors.value]} />
        )}
      </Field>

      <Controller
        control={form.control}
        name="enabled"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Switch
              id="rule-enabled"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked)}
              disabled={isPending}
            />
            <FieldLabel htmlFor="rule-enabled">{COPY.ruleEnabled}</FieldLabel>
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
