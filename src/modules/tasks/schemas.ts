import { z } from "zod";

import { isCalendarDate } from "@/lib/time";
import {
  TASK_CONTENT_MAX,
  TASK_VALIDATION_MESSAGES as M,
} from "./constants";

/**
 * Free text: trimmed, then 1 to 280 characters. Never parsed for amounts or
 * patient data (prompts/23, decision 5).
 */
const content = z
  .string()
  .trim()
  .min(1, { message: M.contentRequired })
  .max(TASK_CONTENT_MAX, { message: M.contentTooLong });

/**
 * A calendar day "yyyy-MM-dd" — a real one, no 31 February. Past days are
 * allowed on purpose: a reminder entered late is still a valid reminder.
 */
const dueDate = z
  .string()
  .refine(isCalendarDate, { message: M.dueDateInvalid })
  .nullish()
  .transform((value) => value ?? null);

const id = z.string().min(1, { message: "Identifiant requis" });

/** One schema for `create` and for the add bar's `zodResolver`. */
export const taskInsertSchema = z.object({
  content,
  dueDate,
  isImportant: z.boolean(),
});

/**
 * Update = insert + id + version token. `expectedUpdatedAt` is the
 * `updatedAt` the editor loaded; a save by someone else since makes the write
 * a CONFLICT instead of a silent overwrite.
 */
export const taskUpdateSchema = taskInsertSchema.extend({
  id,
  expectedUpdatedAt: z.date(),
});

/** A set, not a toggle: sending `true` twice leaves the task done once. */
export const taskSetDoneSchema = z.object({ id, isDone: z.boolean() });

export const taskIdSchema = z.object({ id });

/** What the form holds (input side) and what it submits (output side). */
export type TaskFormValues = z.input<typeof taskInsertSchema>;
export type TaskValues = z.output<typeof taskInsertSchema>;
