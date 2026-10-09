import { describe, expect, it } from "vitest";

import { TASK_VALIDATION_MESSAGES as M } from "./constants";
import {
  taskInsertSchema,
  taskSetDoneSchema,
  taskUpdateSchema,
} from "./schemas";

const valid = { content: "Relancer le laboratoire", dueDate: null, isImportant: false };

const firstMessage = (input: unknown) => {
  const result = taskInsertSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("taskInsertSchema — content", () => {
  it("trims the content", () => {
    const parsed = taskInsertSchema.parse({ ...valid, content: "  Appeler M. Alaoui  " });
    expect(parsed.content).toBe("Appeler M. Alaoui");
  });

  it("rejects an empty or whitespace-only content with the French message", () => {
    expect(firstMessage({ ...valid, content: "" })).toBe(M.contentRequired);
    expect(firstMessage({ ...valid, content: "   \n\t " })).toBe(M.contentRequired);
  });

  it("accepts 1 and 280 characters, rejects 281", () => {
    expect(taskInsertSchema.safeParse({ ...valid, content: "a" }).success).toBe(true);
    expect(taskInsertSchema.safeParse({ ...valid, content: "a".repeat(280) }).success).toBe(true);
    expect(firstMessage({ ...valid, content: "a".repeat(281) })).toBe(M.contentTooLong);
  });

  it("counts the length after trimming", () => {
    const padded = `   ${"a".repeat(280)}   `;
    expect(taskInsertSchema.safeParse({ ...valid, content: padded }).success).toBe(true);
  });
});

describe("taskInsertSchema — dueDate", () => {
  it("accepts a real yyyy-MM-dd day", () => {
    expect(taskInsertSchema.parse({ ...valid, dueDate: "2026-06-25" }).dueDate).toBe("2026-06-25");
  });

  it("accepts a day in the past — a reminder entered late is still valid", () => {
    expect(taskInsertSchema.safeParse({ ...valid, dueDate: "2020-01-01" }).success).toBe(true);
  });

  it("normalises a missing or null due date to null", () => {
    expect(taskInsertSchema.parse({ ...valid, dueDate: undefined }).dueDate).toBeNull();
    expect(
      taskInsertSchema.parse({ content: valid.content, isImportant: false }).dueDate,
    ).toBeNull();
  });

  it.each(["2026-02-30", "2026-13-01", "25/06/2026", "2026-6-5", "2026-06-25T10:00", ""])(
    "rejects %j with the French message",
    (dueDate) => {
      expect(firstMessage({ ...valid, dueDate })).toBe(M.dueDateInvalid);
    },
  );
});

describe("taskUpdateSchema / taskSetDoneSchema", () => {
  it("is the insert schema plus id and a Date version token", () => {
    const at = new Date("2026-06-20T10:00:00.123Z");
    const parsed = taskUpdateSchema.parse({ ...valid, id: "t1", expectedUpdatedAt: at });
    expect(parsed.expectedUpdatedAt).toEqual(at);
    expect(taskUpdateSchema.safeParse({ ...valid, id: "t1" }).success).toBe(false);
  });

  it("setDone takes the target state, not a toggle", () => {
    expect(taskSetDoneSchema.parse({ id: "t1", isDone: true })).toEqual({ id: "t1", isDone: true });
    expect(taskSetDoneSchema.safeParse({ id: "t1" }).success).toBe(false);
  });
});
