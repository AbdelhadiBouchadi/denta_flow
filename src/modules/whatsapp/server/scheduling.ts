import "server-only";

import { and, asc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { nanoid } from "nanoid";

import { db } from "@/database";
import {
  appointments,
  whatsappMessages,
  whatsappRules,
  whatsappSettings,
} from "@/database/schema";
import { fromPgTime } from "@/lib/time";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  CANCELED_APPOINTMENT_STATUS,
  DEFAULT_MIN_LEAD_MINUTES,
  DEFAULT_WINDOW_END,
  DEFAULT_WINDOW_START,
  OCCURRENCE_CANCELED,
  OCCURRENCE_CREATED,
} from "../constants";
import { computeSchedule, type SendWindow } from "../schedule";
import {
  WhatsappEvent,
  WhatsappMessageStatus,
  WhatsappSkipReason,
} from "../types";

/**
 * The schedule side of the slice: how an appointment change becomes message
 * rows (prompts/33, decisions 3 and 6).
 *
 * The appointments slice reads `loadMessagingContext()` alongside the reads it
 * already makes (in parallel, no extra sequential round trip) and puts
 * `buildMessageStatements()` INSIDE its existing `db.batch` — one Neon
 * transaction, so a booking and its messages land together or not at all.
 * Every statement is also guarded on the appointment's NEW state (its new
 * start, its new status): a write refused as CONFLICT matches no row, and
 * then its message statements match nothing either.
 */

export interface MessagingRule {
  id: string;
  event: WhatsappEvent;
  offsetMinutes: number;
}

export interface MessagingContext {
  settings: SendWindow & { enabled: boolean };
  /** Enabled rules only. */
  rules: MessagingRule[];
}

export const DEFAULT_SEND_WINDOW: SendWindow = {
  windowStart: DEFAULT_WINDOW_START,
  windowEnd: DEFAULT_WINDOW_END,
  minLeadMinutes: DEFAULT_MIN_LEAD_MINUTES,
};

/** The settings row as the pure functions read it. */
export const toSendWindow = (row: {
  windowStart: string;
  windowEnd: string;
  minLeadMinutes: number;
}): SendWindow => ({
  windowStart: fromPgTime(row.windowStart),
  windowEnd: fromPgTime(row.windowEnd),
  minLeadMinutes: row.minLeadMinutes,
});

/** Settings and enabled rules — one batch, one round trip. */
export const loadMessagingContext = async (): Promise<MessagingContext> => {
  const [[settings], rules] = await db.batch([
    db
      .select({
        enabled: whatsappSettings.enabled,
        windowStart: whatsappSettings.windowStart,
        windowEnd: whatsappSettings.windowEnd,
        minLeadMinutes: whatsappSettings.minLeadMinutes,
      })
      .from(whatsappSettings)
      .limit(1),
    db
      .select({
        id: whatsappRules.id,
        event: whatsappRules.event,
        offsetMinutes: whatsappRules.offsetMinutes,
      })
      .from(whatsappRules)
      .where(eq(whatsappRules.enabled, true))
      .orderBy(asc(whatsappRules.offsetMinutes), asc(whatsappRules.id)),
  ]);

  return {
    settings: settings
      ? { enabled: settings.enabled, ...toSendWindow(settings) }
      : { enabled: false, ...DEFAULT_SEND_WINDOW },
    rules: rules.map((rule) => ({ ...rule, event: rule.event as WhatsappEvent })),
  };
};

export type AppointmentChange =
  | { kind: "created"; appointmentId: string; startsAt: Date; now: Date }
  | {
      kind: "rescheduled";
      appointmentId: string;
      startsAt: Date;
      now: Date;
    }
  | { kind: "canceled"; appointmentId: string; startsAt: Date; now: Date }
  | { kind: "status"; appointmentId: string; status: string; now: Date }
  | { kind: "removed" };

/** `occurrenceKey` per event (decision 6). */
export const occurrenceKeyFor = (event: WhatsappEvent, forStartsAt: Date) => {
  switch (event) {
    case WhatsappEvent.Confirmation:
      return OCCURRENCE_CREATED;
    case WhatsappEvent.Cancellation:
      return OCCURRENCE_CANCELED;
    default:
      return forStartsAt.toISOString();
  }
};

export interface PlannedMessage {
  appointmentId: string;
  ruleId: string;
  event: WhatsappEvent;
  forStartsAt: Date;
  scheduledFor: Date;
  status: WhatsappMessageStatus.Scheduled | WhatsappMessageStatus.Skipped;
  skipReason: WhatsappSkipReason | null;
}

/** One rule applied to one appointment — the pure half of a row. */
export const planMessage = ({
  appointmentId,
  rule,
  startsAt,
  now,
  settings,
}: {
  appointmentId: string;
  rule: MessagingRule;
  startsAt: Date;
  now: Date;
  settings: SendWindow;
}): PlannedMessage => {
  const result = computeSchedule({
    event: rule.event,
    startsAt,
    now,
    rule,
    settings,
  });
  return "skip" in result
    ? {
        appointmentId,
        ruleId: rule.id,
        event: rule.event,
        forStartsAt: startsAt,
        // A skipped row keeps the moment it was decided, for the lists.
        scheduledFor: now,
        status: WhatsappMessageStatus.Skipped,
        skipReason: result.skip,
      }
    : {
        appointmentId,
        ruleId: rule.id,
        event: rule.event,
        forStartsAt: startsAt,
        scheduledFor: result.scheduledFor,
        status: WhatsappMessageStatus.Scheduled,
        skipReason: null,
      };
};

/**
 * INSERT … SELECT … WHERE <guard>: written only while the appointment is in
 * the state the change describes. On the occurrence's unique key, a row
 * canceled earlier (the appointment moved away and back) is revived; a row
 * already sent, skipped or opened stays as history and is never resent.
 */
export const insertMessageStatement = (
  message: PlannedMessage,
  guard: SQL | null,
) => sql`
  INSERT INTO ${whatsappMessages}
    (id, appointment_id, rule_id, event, occurrence_key, for_starts_at,
     scheduled_for, status, skip_reason)
  SELECT
    ${nanoid()}, ${message.appointmentId}, ${message.ruleId},
    ${message.event}::whatsapp_event,
    ${occurrenceKeyFor(message.event, message.forStartsAt)},
    ${message.forStartsAt.toISOString()}::timestamptz,
    ${message.scheduledFor.toISOString()}::timestamptz,
    ${message.status}::whatsapp_message_status,
    ${message.skipReason}::whatsapp_skip_reason
  ${guard ? sql`WHERE ${guard}` : sql``}
  ON CONFLICT (appointment_id, rule_id, occurrence_key) DO UPDATE SET
    status = excluded.status,
    skip_reason = excluded.skip_reason,
    scheduled_for = excluded.scheduled_for,
    for_starts_at = excluded.for_starts_at,
    updated_at = now()
  WHERE ${whatsappMessages.status} = 'canceled'`;

const appointmentIs = (appointmentId: string, condition: SQL) =>
  sql`EXISTS (SELECT 1 FROM ${appointments} WHERE ${and(eq(appointments.id, appointmentId), condition)})`;

const isActive = inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]);

/** Still-scheduled rows of one appointment become `canceled` with a reason. */
const cancelScheduled = (
  appointmentId: string,
  reason: WhatsappSkipReason,
  where: SQL | undefined,
  guard: SQL,
) =>
  db
    .update(whatsappMessages)
    .set({ status: "canceled", skipReason: reason, updatedAt: new Date() })
    .where(
      and(
        eq(whatsappMessages.appointmentId, appointmentId),
        eq(whatsappMessages.status, "scheduled"),
        where,
        guard,
      ),
    );

const rulesFor = (context: MessagingContext, ...events: WhatsappEvent[]) =>
  context.rules.filter((rule) => events.includes(rule.event));

/**
 * The statements one appointment change adds to its batch. Nothing when no
 * enabled rule concerns the change. Rows are created whatever the global
 * switch says — in manual mode they are the «Rappels» page's to-do list —
 * and the cron only ever SENDS in automatic mode.
 */
export const buildMessageStatements = (
  context: MessagingContext,
  change: AppointmentChange,
): BatchItem<"pg">[] => {
  const { settings } = context;

  switch (change.kind) {
    case "removed":
      // The rows cascade with the appointment.
      return [];

    case "created": {
      const plan = (rule: MessagingRule) =>
        planMessage({ ...change, rule, settings });
      // Placed after the appointment's INSERT in the batch: no guard needed,
      // a refused booking fails the whole batch.
      return rulesFor(context, WhatsappEvent.Reminder, WhatsappEvent.Confirmation).map(
        (rule) => db.execute(insertMessageStatement(plan(rule), null)),
      );
    }

    case "rescheduled": {
      const guard = appointmentIs(
        change.appointmentId,
        and(
          eq(appointments.startsAt, change.startsAt),
          isActive,
        )!,
      );
      const supersede = cancelScheduled(
        change.appointmentId,
        WhatsappSkipReason.Superseded,
        and(
          inArray(whatsappMessages.event, [
            WhatsappEvent.Reminder,
            WhatsappEvent.Confirmation,
            WhatsappEvent.Reschedule,
          ]),
          sql`${whatsappMessages.forStartsAt} <> ${change.startsAt.toISOString()}::timestamptz`,
        ),
        guard,
      );
      const inserts = rulesFor(
        context,
        WhatsappEvent.Reminder,
        WhatsappEvent.Reschedule,
      ).map((rule) =>
        db.execute(
          insertMessageStatement(
            planMessage({ ...change, rule, settings }),
            guard,
          ),
        ),
      );
      return [supersede, ...inserts];
    }

    case "canceled": {
      const guard = appointmentIs(
        change.appointmentId,
        eq(appointments.status, CANCELED_APPOINTMENT_STATUS),
      );
      const cancelPending = cancelScheduled(
        change.appointmentId,
        WhatsappSkipReason.AppointmentStatus,
        sql`${whatsappMessages.event} <> 'cancellation'`,
        guard,
      );
      const inserts = rulesFor(context, WhatsappEvent.Cancellation).map((rule) =>
        db.execute(
          insertMessageStatement(
            planMessage({ ...change, rule, settings }),
            guard,
          ),
        ),
      );
      return [cancelPending, ...inserts];
    }

    case "status": {
      // Back on the books (confirmed): nothing to cancel.
      if ((ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(change.status)) {
        return [];
      }
      // Arrived, completed, no-show: a pending reminder no longer means anything.
      const guard = appointmentIs(
        change.appointmentId,
        sql`${appointments.status} = ${change.status}`,
      );
      return [
        cancelScheduled(
          change.appointmentId,
          WhatsappSkipReason.AppointmentStatus,
          undefined,
          guard,
        ),
      ];
    }
  }
};

/**
 * `backfill()` — reminder rows for every FUTURE active appointment that has
 * none for an enabled reminder rule. Never confirmation, reschedule or
 * cancellation rows: those belong to an event that already happened.
 */
export const backfillReminders = async (
  context: MessagingContext,
  now: Date,
  onlyRuleId?: string,
) => {
  const rules = rulesFor(context, WhatsappEvent.Reminder).filter(
    (rule) => !onlyRuleId || rule.id === onlyRuleId,
  );
  if (rules.length === 0) return 0;

  const upcoming = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt })
    .from(appointments)
    .where(and(gt(appointments.startsAt, now), isActive));

  const statements = upcoming.flatMap((appointment) =>
    rules.map((rule) =>
      db.execute(
        sql`${insertMessageStatement(
          planMessage({
            appointmentId: appointment.id,
            rule,
            startsAt: appointment.startsAt,
            now,
            settings: context.settings,
          }),
          null,
        )} RETURNING id`,
      ),
    ),
  );

  let created = 0;
  // Neon HTTP payload limits: a few hundred statements per batch.
  for (let index = 0; index < statements.length; index += 200) {
    const chunk = statements.slice(index, index + 200);
    const results = await db.batch(
      chunk as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]],
    );
    for (const result of results) {
      created += (result as { rowCount?: number | null }).rowCount ?? 0;
    }
  }
  return created;
};

/**
 * After a rule's timing or the send window changed: every still-scheduled row
 * concerned is planned again from its appointment's start (or, for the
 * after-event messages, from when the row was created).
 */
export const replanScheduledRows = async (
  context: MessagingContext,
  now: Date,
  ruleId?: string,
) => {
  const rows = await db
    .select({
      id: whatsappMessages.id,
      ruleId: whatsappMessages.ruleId,
      event: whatsappMessages.event,
      forStartsAt: whatsappMessages.forStartsAt,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.status, "scheduled"),
        ruleId ? eq(whatsappMessages.ruleId, ruleId) : undefined,
      ),
    );

  const rules = new Map(context.rules.map((rule) => [rule.id, rule]));
  const updates = rows.flatMap((row) => {
    const rule = row.ruleId ? rules.get(row.ruleId) : undefined;
    if (!rule) return [];
    const result = computeSchedule({
      event: row.event as WhatsappEvent,
      startsAt: row.forStartsAt,
      now,
      rule,
      settings: context.settings,
      eventAt: row.event === WhatsappEvent.Reminder ? undefined : row.createdAt,
    });
    const guard = and(
      eq(whatsappMessages.id, row.id),
      eq(whatsappMessages.status, "scheduled"),
    );
    return [
      db
        .update(whatsappMessages)
        .set(
          "skip" in result
            ? { status: "skipped", skipReason: result.skip, updatedAt: now }
            : { scheduledFor: result.scheduledFor, updatedAt: now },
        )
        .where(guard),
    ];
  });

  for (let index = 0; index < updates.length; index += 200) {
    const chunk = updates.slice(index, index + 200);
    await db.batch(chunk as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  }
  return updates.length;
};
