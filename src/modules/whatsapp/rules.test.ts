import { describe, expect, it } from "vitest";

import { WHATSAPP_ERRORS } from "./constants";
import {
  isOffsetValid,
  ruleConstraintError,
  ruleEventFor,
  splitOffset,
  templateKindChangeError,
  templateRemovalError,
  type RuleShape,
} from "./rules";
import { WhatsappEvent as E } from "./types";

const rule = (id: string, event: E, offsetMinutes: number, templateId = "t1"): RuleShape => ({
  id,
  event,
  offsetMinutes,
  templateId,
});

describe("timing bounds per kind", () => {
  it("reminder: 1 h to 7 days", () => {
    expect(isOffsetValid(E.Reminder, 59)).toBe(false);
    expect(isOffsetValid(E.Reminder, 60)).toBe(true);
    expect(isOffsetValid(E.Reminder, 7 * 1440)).toBe(true);
    expect(isOffsetValid(E.Reminder, 7 * 1440 + 1)).toBe(false);
  });

  it("other kinds: 0 to 24 h", () => {
    for (const event of [E.Confirmation, E.Reschedule, E.Cancellation]) {
      expect(isOffsetValid(event, 0)).toBe(true);
      expect(isOffsetValid(event, 1440)).toBe(true);
      expect(isOffsetValid(event, 1441)).toBe(false);
      expect(isOffsetValid(event, -1)).toBe(false);
    }
    expect(isOffsetValid(E.Confirmation, 1.5)).toBe(false);
  });
});

describe("ruleConstraintError", () => {
  const existing = [rule("r1", E.Reminder, 1440), rule("r2", E.Cancellation, 0)];

  it("allows a second reminder with another offset", () => {
    expect(ruleConstraintError(existing, { event: E.Reminder, offsetMinutes: 120 })).toBeNull();
  });

  it("refuses two reminders with the same offset", () => {
    expect(ruleConstraintError(existing, { event: E.Reminder, offsetMinutes: 1440 })).toBe(
      WHATSAPP_ERRORS.duplicateReminderOffset,
    );
  });

  it("refuses a fourth reminder", () => {
    const three = [
      rule("a", E.Reminder, 60),
      rule("b", E.Reminder, 120),
      rule("c", E.Reminder, 1440),
    ];
    expect(ruleConstraintError(three, { event: E.Reminder, offsetMinutes: 2880 })).toBe(
      WHATSAPP_ERRORS.tooManyReminders,
    );
  });

  it("allows one rule per other event", () => {
    expect(ruleConstraintError(existing, { event: E.Cancellation, offsetMinutes: 30 })).toBe(
      WHATSAPP_ERRORS.ruleExistsForEvent,
    );
    expect(ruleConstraintError(existing, { event: E.Confirmation, offsetMinutes: 0 })).toBeNull();
  });

  it("does not compare an edited rule with itself", () => {
    expect(
      ruleConstraintError(existing, { id: "r2", event: E.Cancellation, offsetMinutes: 30 }),
    ).toBeNull();
    expect(
      ruleConstraintError(existing, { id: "r1", event: E.Reminder, offsetMinutes: 1440 }),
    ).toBeNull();
  });
});

describe("templates and rules", () => {
  it("a rule's event always equals its template's kind", () => {
    for (const kind of Object.values(E)) {
      expect(ruleEventFor({ kind })).toBe(kind);
    }
  });

  it("a template used by a rule cannot be deleted", () => {
    const rules = [rule("r1", E.Reminder, 1440, "used")];
    expect(templateRemovalError("used", rules)).toBe(WHATSAPP_ERRORS.templateInUse);
    expect(templateRemovalError("free", rules)).toBeNull();
  });

  it("a used template cannot change kind; a free one can", () => {
    const rules = [rule("r1", E.Reminder, 1440, "used")];
    expect(templateKindChangeError({ id: "used", kind: E.Reminder }, E.Confirmation, rules)).toBe(
      WHATSAPP_ERRORS.templateKindInUse,
    );
    expect(templateKindChangeError({ id: "used", kind: E.Reminder }, E.Reminder, rules)).toBeNull();
    expect(templateKindChangeError({ id: "free", kind: E.Reminder }, E.Confirmation, rules)).toBeNull();
  });
});

describe("splitOffset", () => {
  it("uses the largest whole unit", () => {
    expect(splitOffset(1440)).toEqual({ value: 1, unit: "days" });
    expect(splitOffset(120)).toEqual({ value: 2, unit: "hours" });
    expect(splitOffset(90)).toEqual({ value: 90, unit: "minutes" });
    expect(splitOffset(0)).toEqual({ value: 0, unit: "minutes" });
  });
});
