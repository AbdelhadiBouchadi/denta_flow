"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { toClinicDate } from "@/lib/time";
import { ToothSelect } from "@/modules/treatments/ui/tooth-select";
import { useTRPC } from "@/trpc/client";
import { IMAGING_COPY as COPY } from "../constants";
import { useInvalidateImaging } from "../hooks/use-invalidate-imaging";
import {
  imagingMetadataSchema,
  type ImagingMetadataFormValues,
  type ImagingMetadataValues,
} from "../schemas";
import type { ImagingFile, PatientFileKind } from "../types";
import { KindSelect, TakenDatePicker } from "./metadata-fields";

interface ImageMetadataFormProps {
  file: ImagingFile;
  onDone: () => void;
}

/**
 * The viewer's «Modifier»: kind, date, teeth and note — never the file. The
 * version token is the `updatedAt` of the row the viewer shows; someone
 * else's save since then is a CONFLICT, answered by a reload of the list
 * (the viewer then shows the saved version) and a French toast.
 */
export const ImageMetadataForm = ({ file, onDone }: ImageMetadataFormProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateImaging();

  const form = useForm<ImagingMetadataFormValues, unknown, ImagingMetadataValues>({
    resolver: zodResolver(imagingMetadataSchema),
    defaultValues: {
      kind: file.kind as PatientFileKind,
      takenDate: toClinicDate(file.takenAt),
      notes: file.notes ?? "",
      teeth: file.teeth,
    },
  });

  const update = useMutation(trpc.imaging.update.mutationOptions());

  const submit = async (values: ImagingMetadataValues) => {
    try {
      await update.mutateAsync({
        ...values,
        id: file.id,
        expectedUpdatedAt: file.updatedAt,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
      const code = (error as { data?: { code?: string } | null }).data?.code;
      if (code === "CONFLICT" || code === "NOT_FOUND") {
        await invalidate();
        onDone();
      }
      return;
    }
    await invalidate();
    toast.success(COPY.updated);
    onDone();
  };

  const isPending = update.isPending;

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="kind"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="image-kind">{COPY.kind}</FieldLabel>
              <KindSelect
                id="image-kind"
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="takenDate"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="image-date">{COPY.takenDate}</FieldLabel>
              <TakenDatePicker
                id="image-date"
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="teeth"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="image-teeth">{COPY.teeth}</FieldLabel>
              {/* The full grid: the side panel is wide enough, and editing
                  teeth is this form's main job on a rétro-alvéolaire. */}
              <ToothSelect
                id="image-teeth"
                value={field.value ?? []}
                onChange={field.onChange}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="image-notes">{COPY.notes}</FieldLabel>
              <Textarea
                {...field}
                id="image-notes"
                value={field.value ?? ""}
                rows={3}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder={COPY.notesPlaceholder}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onDone}
          className="flex-1"
        >
          {COPY.cancel}
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending && <Spinner aria-label={COPY.saving} />}
          {isPending ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
};
