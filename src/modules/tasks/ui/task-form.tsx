"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { TASK_CONTENT_MAX, TASK_COPY as COPY } from "../constants";
import { useInvalidateTasks } from "../hooks/use-invalidate-tasks";
import {
  taskInsertSchema,
  type TaskFormValues,
  type TaskValues,
} from "../schemas";
import type { TaskListItem } from "../types";
import { ImportanceToggle } from "./importance-toggle";
import { TaskDueDatePicker } from "./task-due-date-picker";

interface TaskFormProps {
  /** The task being edited. Creating happens in the add bar only. */
  initialValues: TaskListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toFormValues = (task: TaskListItem): TaskFormValues => ({
  content: task.content,
  dueDate: task.dueDate,
  isImportant: task.isImportant,
});

/**
 * Edit a task: content, due date, importance. Validated by the same schema
 * as `create`; the write carries the loaded `updatedAt` so a concurrent edit
 * is a CONFLICT, never a silent overwrite.
 */
export const TaskForm = ({ initialValues, onSuccess, onCancel }: TaskFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTasks();

  const form = useForm<TaskFormValues, unknown, TaskValues>({
    resolver: zodResolver(taskInsertSchema),
    defaultValues: toFormValues(initialValues),
  });

  const updateTask = useMutation(trpc.tasks.update.mutationOptions());
  const isPending = updateTask.isPending;

  const onSubmit = async (values: TaskValues) => {
    try {
      await updateTask.mutateAsync({
        ...values,
        id: initialValues.id,
        expectedUpdatedAt: initialValues.updatedAt,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
      // CONFLICT or NOT_FOUND: the row on screen is stale either way. The
      // refetch shows the saved version; the dialog closes on it.
      const code = (error as { data?: { code?: string } | null }).data?.code;
      if (code === "CONFLICT" || code === "NOT_FOUND") {
        await invalidateAll();
        onCancel?.();
      }
      return;
    }

    await invalidateAll();
    toast.success(COPY.updated);
    onSuccess?.();
  };

  const content = useWatch({ control: form.control, name: "content" });
  const contentLength = content.trim().length;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="@container flex flex-col gap-4"
    >
      <FieldGroup className="gap-4 px-4">
        <Controller
          control={form.control}
          name="content"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{COPY.contentFieldLabel}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={3}
                maxLength={TASK_CONTENT_MAX}
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                className="break-words"
              />
              <FieldDescription className="text-right tabular-nums">
                {contentLength} / {TASK_CONTENT_MAX}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="grid gap-4 @md:grid-cols-[minmax(0,1fr)_auto] [&>*]:min-w-0">
          <Controller
            control={form.control}
            name="dueDate"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{COPY.dueDateLabel}</FieldLabel>
                <TaskDueDatePicker
                  id={field.name}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  disabled={isPending}
                  invalid={fieldState.invalid}
                  className="w-full"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="isImportant"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {COPY.importanceFieldLabel}
                </FieldLabel>
                <ImportanceToggle
                  id={field.name}
                  size="lg"
                  pressed={field.value}
                  onPressedChange={field.onChange}
                  disabled={isPending}
                  className="w-fit"
                />
              </Field>
            )}
          />
        </div>
      </FieldGroup>

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
          {isPending && <Spinner aria-hidden="true" />}
          {isPending ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
};
