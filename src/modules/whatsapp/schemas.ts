import { z } from "zod";

import { DEFAULT_PAGE } from "@/constants";
import { isCalendarDate, wallClockToMinutes, WALL_CLOCK_PATTERN } from "@/lib/time";
import {
  CONSENT_VALUES,
  CONTENT_SID_PATTERN,
  EVENT_VALUES,
  STATUS_VALUES,
  TIMING_UNITS,
  WHATSAPP_VALIDATION as V,
} from "./constants";
import { toWhatsAppNumber } from "./phone";
import { isOffsetValid } from "./rules";
import { WhatsappEvent } from "./types";

/**
 * One schema per contract, shared by the procedure's `.input()` and the
 * form's `zodResolver`. Every message is French copy (06-ui.md §10).
 */

const id = z.string().min(1);

/** "" (the URL default) or a clinic calendar day. */
const optionalDay = z
  .string()
  .refine((value) => value === "" || isCalendarDate(value), { message: V.day });

const wallClock = z.string().regex(WALL_CLOCK_PATTERN, { message: V.windowFormat });

// ── Settings ────────────────────────────────────────────────────────────────

export const settingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    windowStart: wallClock,
    windowEnd: wallClock,
    minLeadMinutes: z
      .number({ message: V.minLead })
      .int({ message: V.minLead })
      .min(0, { message: V.minLead })
      .max(1440, { message: V.minLead }),
  })
  .refine(
    (value) =>
      !WALL_CLOCK_PATTERN.test(value.windowStart) ||
      !WALL_CLOCK_PATTERN.test(value.windowEnd) ||
      wallClockToMinutes(value.windowStart) < wallClockToMinutes(value.windowEnd),
    { message: V.windowOrder, path: ["windowEnd"] },
  );

export type SettingsUpdateValues = z.infer<typeof settingsUpdateSchema>;

// ── Templates ───────────────────────────────────────────────────────────────

export const templateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: V.nameRequired })
    .max(80, { message: V.nameTooLong }),
  kind: z.enum(EVENT_VALUES, { message: V.event }),
  // "" — an untouched field — is «not configured».
  contentSid: z
    .string()
    .nullable()
    .transform((value) => (value?.trim() ? value.trim() : null))
    .refine((value) => value === null || CONTENT_SID_PATTERN.test(value), {
      message: V.contentSid,
    }),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(_[A-Z]{2})?$/, { message: V.language }),
  manualText: z
    .string()
    .trim()
    .min(1, { message: V.manualTextRequired })
    .max(1000, { message: V.manualTextTooLong }),
  isActive: z.boolean(),
});

export const templateUpdateSchema = templateFormSchema.extend({ id });

export type TemplateFormValues = z.input<typeof templateFormSchema>;
export type TemplateValues = z.output<typeof templateFormSchema>;

// ── Rules ───────────────────────────────────────────────────────────────────

const UNIT_VALUES = TIMING_UNITS.map((unit) => unit.value) as [
  (typeof TIMING_UNITS)[number]["value"],
  ...(typeof TIMING_UNITS)[number]["value"][],
];

export const unitMinutes = (unit: (typeof UNIT_VALUES)[number]) =>
  TIMING_UNITS.find((entry) => entry.value === unit)!.minutes;

/**
 * The rule dialog: a template, then a value and a unit. `event` is the
 * selected template's kind, carried only so the bounds can be checked in the
 * form — the server reads the event from the template and ignores this one.
 */
export const ruleFormSchema = z
  .object({
    templateId: z.string().min(1, { message: V.templateRequired }),
    event: z.enum(EVENT_VALUES, { message: V.event }),
    value: z
      .number({ message: V.offsetInteger })
      .int({ message: V.offsetInteger })
      .min(0, { message: V.offsetInteger }),
    unit: z.enum(UNIT_VALUES),
    enabled: z.boolean(),
  })
  .refine((rule) => isOffsetValid(rule.event, rule.value * unitMinutes(rule.unit)), {
    path: ["value"],
    error: (issue) =>
      (issue.input as { event?: WhatsappEvent } | undefined)?.event ===
      WhatsappEvent.Reminder
        ? V.offsetReminder
        : V.offsetDelay,
  });

export const ruleUpdateSchema = ruleFormSchema.safeExtend({ id });

export type RuleFormValues = z.input<typeof ruleFormSchema>;

export const ruleToggleSchema = z.object({ id, enabled: z.boolean() });

// ── Reads ───────────────────────────────────────────────────────────────────

/** `day` "" ⇒ tomorrow, resolved by the procedure on the clinic clock. */
export const byDaySchema = z.object({ day: optionalDay });

export const journalSchema = z.object({
  // "" ⇒ the last 7 days, resolved by the procedure.
  from: optionalDay,
  to: optionalDay,
  event: z.enum(EVENT_VALUES).nullable(),
  status: z.enum(STATUS_VALUES).nullable(),
  q: z.string().trim().max(80),
  page: z.number().int().min(1).default(DEFAULT_PAGE),
});

export const messageIdSchema = z.object({ id });
export const appointmentIdSchema = z.object({ appointmentId: id });

// ── Actions ─────────────────────────────────────────────────────────────────

export const sendTestSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, { message: V.phoneRequired })
    .refine((value) => toWhatsAppNumber(value).ok, { message: V.phoneInvalid }),
  event: z.enum(EVENT_VALUES, { message: V.event }),
});

export type SendTestValues = z.infer<typeof sendTestSchema>;

/** The patients slice's consent filter and field. */
export const consentSchema = z.enum(CONSENT_VALUES);
