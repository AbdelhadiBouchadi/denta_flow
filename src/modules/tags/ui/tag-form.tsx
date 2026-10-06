"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { COLOR_PALETTE, ColorPicker } from "@/components/shared/color-picker";
import TagBadge from "@/components/shared/tag-badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  getTagIcon,
  TAG_COPY,
  TAG_FIELD_LABELS,
  TAG_FIELD_PLACEHOLDERS,
} from "../constants";
import { useInvalidateTags } from "../hooks/use-invalidate-tags";
import { tagFormSchema, type TagFormValues, type TagValues } from "../schemas";
import type { TagListItem } from "../types";
import { TagIconPicker } from "./tag-icon-picker";

interface TagFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: TagListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (tag?: TagListItem): TagFormValues => ({
  label: tag?.label ?? "",
  color: tag?.color ?? COLOR_PALETTE[0].value,
  icon: tag?.icon ?? "",
});

export const TagForm = ({
  initialValues,
  onSuccess,
  onCancel,
}: TagFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTags();
  const isEdit = !!initialValues;

  const form = useForm<TagFormValues, unknown, TagValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: toFormValues(initialValues),
  });

  // The live preview renders the very badge patients show.
  const [label, color, icon] = useWatch({
    control: form.control,
    name: ["label", "color", "icon"],
  });

  const createTag = useMutation(
    trpc.tags.create.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(TAG_COPY.created);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateTag = useMutation(
    trpc.tags.update.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(TAG_COPY.updated);
        onSuccess?.();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = createTag.isPending || updateTag.isPending;

  const onSubmit = (values: TagValues) => {
    if (isEdit) {
      updateTag.mutate({ id: initialValues.id, ...values });
      return;
    }
    createTag.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldGroup className="gap-4">
        <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
          <span className="text-label text-muted-foreground uppercase">
            {TAG_FIELD_LABELS.preview}
          </span>
          <TagBadge
            label={label?.trim() || TAG_COPY.previewFallback}
            color={color}
            icon={getTagIcon(icon)}
          />
        </div>

        <Controller
          control={form.control}
          name="label"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {TAG_FIELD_LABELS.label}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoFocus
                autoComplete="off"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={TAG_FIELD_PLACEHOLDERS.label}
                className="h-9"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="color"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`${field.name}-label`}>
                {TAG_FIELD_LABELS.color}
              </FieldLabel>
              <ColorPicker
                id={field.name}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                aria-labelledby={`${field.name}-label`}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="icon"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`${field.name}-label`}>
                {TAG_FIELD_LABELS.icon}
              </FieldLabel>
              <TagIconPicker
                id={field.name}
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                aria-labelledby={`${field.name}-label`}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
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
            {TAG_COPY.cancel}
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
              aria-label={isEdit ? TAG_COPY.updating : TAG_COPY.saving}
            />
          )}
          {isPending
            ? isEdit
              ? TAG_COPY.updating
              : TAG_COPY.saving
            : isEdit
              ? TAG_COPY.update
              : TAG_COPY.save}
        </Button>
      </div>
    </form>
  );
};
