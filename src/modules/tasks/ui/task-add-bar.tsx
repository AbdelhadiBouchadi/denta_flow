"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { TASK_CONTENT_MAX, TASK_COPY as COPY } from "../constants";
import { useInvalidateTasks } from "../hooks/use-invalidate-tasks";
import {
  taskInsertSchema,
  type TaskFormValues,
  type TaskValues,
} from "../schemas";
import { ImportanceToggle } from "./importance-toggle";
import { TaskDueDatePicker } from "./task-due-date-picker";

const EMPTY: TaskFormValues = { content: "", dueDate: null, isImportant: false };

/**
 * The only place a task is created: text, star, date, «Ajouter». A real
 * form over the `create` schema — Enter submits natively. After a save the
 * bar clears and the cursor stays in the text field, ready for the next one.
 *
 * The input is never `disabled` while saving: a disabled input drops focus,
 * and the point of the bar is typing several tasks in a row. The button is
 * what stops a second submit.
 */
const TaskAddBar = () => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTasks();

  const form = useForm<TaskFormValues, unknown, TaskValues>({
    resolver: zodResolver(taskInsertSchema),
    defaultValues: EMPTY,
  });

  const createTask = useMutation(trpc.tasks.create.mutationOptions());
  const isPending = createTask.isPending;

  const onSubmit = async (values: TaskValues) => {
    if (isPending) return;
    try {
      await createTask.mutateAsync(values);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    form.reset(EMPTY);
    form.setFocus("content");
    toast.success(COPY.created);
    await invalidateAll();
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      aria-label={COPY.contentLabel}
      className="flex flex-col gap-1.5"
    >
      {/* Narrow: the text on its own row, the controls under it. */}
      <div className="flex flex-wrap items-center gap-2">
        <Controller
          control={form.control}
          name="content"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              aria-label={COPY.contentLabel}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? "task-add-error" : undefined}
              placeholder={COPY.contentPlaceholder}
              autoComplete="off"
              maxLength={TASK_CONTENT_MAX}
              className="h-9 min-w-0 basis-full sm:flex-1 sm:basis-0"
            />
          )}
        />

        <Controller
          control={form.control}
          name="isImportant"
          render={({ field }) => (
            <ImportanceToggle
              size="lg"
              pressed={field.value}
              onPressedChange={field.onChange}
            />
          )}
        />

        <Controller
          control={form.control}
          name="dueDate"
          render={({ field, fieldState }) => (
            <TaskDueDatePicker
              value={field.value ?? null}
              onChange={field.onChange}
              invalid={fieldState.invalid}
              className="flex-1 sm:w-40 sm:flex-none"
            />
          )}
        />

        <Button type="submit" size="lg" disabled={isPending} className="shrink-0">
          {isPending ? <Spinner aria-hidden="true" /> : <PlusIcon />}
          {isPending ? COPY.adding : COPY.add}
        </Button>
      </div>

      {(form.formState.errors.content || form.formState.errors.dueDate) && (
        <Field data-invalid id="task-add-error">
          <FieldError
            errors={[form.formState.errors.content, form.formState.errors.dueDate]}
          />
        </Field>
      )}
    </form>
  );
};

export default TaskAddBar;
