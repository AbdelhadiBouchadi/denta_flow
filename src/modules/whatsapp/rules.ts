import {
  DELAY_OFFSET_MAX,
  DELAY_OFFSET_MIN,
  MAX_REMINDER_RULES,
  REMINDER_OFFSET_MAX,
  REMINDER_OFFSET_MIN,
  WHATSAPP_ERRORS,
} from "./constants";
import { WhatsappEvent } from "./types";

/**
 * Rule and template constraints (prompts/33, decision 2). Pure: the procedures
 * call these for the French message, and the database holds the same rules
 * as constraints (unique indexes, the composite foreign key, the CHECK) for
 * the concurrent case.
 */

export interface RuleShape {
  id: string;
  event: WhatsappEvent;
  offsetMinutes: number;
  templateId: string;
}

/** Reminder: 1 h – 7 days before. Others: 0 – 24 h after. */
export const isOffsetValid = (event: WhatsappEvent, offsetMinutes: number) =>
  Number.isInteger(offsetMinutes) &&
  (event === WhatsappEvent.Reminder
    ? offsetMinutes >= REMINDER_OFFSET_MIN && offsetMinutes <= REMINDER_OFFSET_MAX
    : offsetMinutes >= DELAY_OFFSET_MIN && offsetMinutes <= DELAY_OFFSET_MAX);

/**
 * Why `candidate` cannot join `existing`, or `null`. `candidate.id` set ⇒ an
 * edit: the rule is not compared with itself.
 */
export const ruleConstraintError = (
  existing: readonly RuleShape[],
  candidate: { id?: string; event: WhatsappEvent; offsetMinutes: number },
): string | null => {
  const others = existing.filter((rule) => rule.id !== candidate.id);
  const sameEvent = others.filter((rule) => rule.event === candidate.event);

  if (candidate.event !== WhatsappEvent.Reminder) {
    return sameEvent.length > 0 ? WHATSAPP_ERRORS.ruleExistsForEvent : null;
  }
  if (sameEvent.some((rule) => rule.offsetMinutes === candidate.offsetMinutes)) {
    return WHATSAPP_ERRORS.duplicateReminderOffset;
  }
  if (sameEvent.length >= MAX_REMINDER_RULES) {
    return WHATSAPP_ERRORS.tooManyReminders;
  }
  return null;
};

/** A rule's event is ALWAYS its template's kind — never chosen separately. */
export const ruleEventFor = (template: { kind: WhatsappEvent }) => template.kind;

/** A template used by a rule can be neither deleted nor change kind. */
export const templateRemovalError = (
  templateId: string,
  rules: readonly Pick<RuleShape, "templateId">[],
) =>
  rules.some((rule) => rule.templateId === templateId)
    ? WHATSAPP_ERRORS.templateInUse
    : null;

export const templateKindChangeError = (
  template: { id: string; kind: WhatsappEvent },
  nextKind: WhatsappEvent,
  rules: readonly Pick<RuleShape, "templateId">[],
) =>
  nextKind !== template.kind && rules.some((rule) => rule.templateId === template.id)
    ? WHATSAPP_ERRORS.templateKindInUse
    : null;

/** Splits minutes into the largest whole unit, for the edit dialog. */
export const splitOffset = (offsetMinutes: number) => {
  if (offsetMinutes > 0 && offsetMinutes % (24 * 60) === 0) {
    return { value: offsetMinutes / (24 * 60), unit: "days" as const };
  }
  if (offsetMinutes > 0 && offsetMinutes % 60 === 0) {
    return { value: offsetMinutes / 60, unit: "hours" as const };
  }
  return { value: offsetMinutes, unit: "minutes" as const };
};
