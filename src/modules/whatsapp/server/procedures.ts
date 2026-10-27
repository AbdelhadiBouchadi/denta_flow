import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import {
  appointments,
  clinicSettings,
  patients,
  user,
  whatsappMessages,
  whatsappRules,
  whatsappSettings,
  whatsappTemplates,
} from "@/database/schema";
import { env } from "@/lib/env";
import {
  addCalendarDays,
  calendarDateRange,
  toClinicDate,
  toPgTime,
} from "@/lib/time";
import { logActivity } from "@/modules/activity/server/log";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { postgresErrorCode } from "@/modules/appointments/server/errors";
import { formatPatientName } from "@/modules/patients/derived";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { editPatch } from "../approval";
import {
  DEFAULT_BODIES,
  EVENT_LABELS,
  JOURNAL_DEFAULT_DAYS,
  JOURNAL_MAX_RANGE_DAYS,
  JOURNAL_PAGE_SIZE,
  STATUS_VALUES,
  WHATSAPP_ERRORS,
  WHATSAPP_VALIDATION,
  formatTiming,
  rejectionReasonLabel,
} from "../constants";
import { manualSendOffered, manualSendRefusal } from "../manual";
import { buildMessageParams, formatClinicPhone, SAMPLE_PARAMS } from "../message";
import { isEnvComplete, resolveMode } from "../mode";
import { ENV_KEYS } from "../provider-constants";
import {
  formatSenderNumber,
  maskPhone,
  toWhatsAppNumber,
  waMeLink,
} from "../phone";
import {
  isOffsetValid,
  ruleConstraintError,
  ruleEventFor,
  templateKindChangeError,
  templateRemovalError,
} from "../rules";
import {
  appointmentIdSchema,
  byDaySchema,
  journalSchema,
  messageIdSchema,
  ruleFormSchema,
  ruleToggleSchema,
  ruleUpdateSchema,
  sendTestSchema,
  settingsUpdateSchema,
  templateCreateSchema,
  templateIdSchema,
  templateUpdateSchema,
  unitMinutes,
} from "../schemas";
import { canRetry } from "../status";
import {
  chipValuesFrom,
  fromCanonical,
  MalformedBodyError,
  renderCanonical,
  renderSegments,
  sameCanonical,
  toCanonical,
} from "../template-body";
import {
  MessageChip,
  TemplateApproval,
  UnscheduledReason,
  WhatsappConsent,
  WhatsappEvent,
  WhatsappMessageStatus,
  WhatsappMode,
  type BodySegment,
} from "../types";
import {
  contentApiFor,
  refreshTemplateStatuses,
  submissionAvailability,
  submitTemplateForApproval,
} from "./approval";
import { createTwilioProvider } from "./provider/twilio";
import { readWhatsappEnv, webhookUrl } from "./provider/twilio-env";
import { attentionCountQuery } from "./queries";
import {
  backfillReminders,
  loadMessagingContext,
  replanScheduledRows,
  toSendWindow,
} from "./scheduling";

/**
 * The WhatsApp slice (prompts/33). «Rappels» and its two actions are for all
 * staff; everything under Paramètres › WhatsApp is `adminProcedure`.
 * No staff scoping anywhere (AGENTS.md §2). Automatic sends are not written
 * to the activity log — the messages table is their log; every human action
 * here is.
 */

// ── Shared reads ────────────────────────────────────────────────────────────

const SETTINGS_ID = "whatsapp";

const readSettings = async () => {
  const [row] = await db.select().from(whatsappSettings).limit(1);
  if (row) return row;
  // The migration inserts the row; recreate it if someone deleted it.
  const [created] = await db
    .insert(whatsappSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(whatsappSettings).limit(1))[0];
};

const readClinic = async () => {
  const [row] = await db
    .select({ name: clinicSettings.name, phone: clinicSettings.phone })
    .from(clinicSettings)
    .limit(1);
  return {
    name: row?.name?.trim() || env.NEXT_PUBLIC_CLINIC_NAME,
    phone: row?.phone?.trim() || null,
  };
};

const currentMode = (enabled: boolean) => {
  const whatsappEnv = readWhatsappEnv();
  return {
    whatsappEnv,
    mode: resolveMode({
      presence: whatsappEnv.presence,
      from: whatsappEnv.from,
      enabled,
    }),
  };
};

const notFound = (message: string) =>
  new TRPCError({ code: "NOT_FOUND", message });

const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/** The activity line every human WhatsApp action leaves. */
const logWhatsapp = (
  staffId: string,
  entityId: string,
  action: ActivityAction,
  summary: string,
  patientId: string | null = null,
) =>
  logActivity({
    entityType: ActivityEntityType.Whatsapp,
    entityId,
    action,
    patientId,
    summary,
    staffId,
  });

/** The message row with everything a manual send or the lists need. */
const selectMessageRows = () =>
  db
    .select({
      id: whatsappMessages.id,
      event: whatsappMessages.event,
      status: whatsappMessages.status,
      skipReason: whatsappMessages.skipReason,
      channel: whatsappMessages.channel,
      forStartsAt: whatsappMessages.forStartsAt,
      scheduledFor: whatsappMessages.scheduledFor,
      sentAt: whatsappMessages.sentAt,
      deliveredAt: whatsappMessages.deliveredAt,
      readAt: whatsappMessages.readAt,
      failedAt: whatsappMessages.failedAt,
      openedAt: whatsappMessages.openedAt,
      errorCode: whatsappMessages.errorCode,
      errorMessage: whatsappMessages.errorMessage,
      appointment: {
        id: appointments.id,
        status: appointments.status,
        startsAt: appointments.startsAt,
      },
      patient: {
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        phone: patients.phone,
        consent: patients.whatsappConsent,
      },
      practitioner: { name: user.name },
      template: {
        body: whatsappTemplates.body,
        variables: whatsappTemplates.variables,
      },
    })
    .from(whatsappMessages)
    .innerJoin(appointments, eq(whatsappMessages.appointmentId, appointments.id))
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(user, eq(appointments.practitionerId, user.id))
    .leftJoin(whatsappRules, eq(whatsappMessages.ruleId, whatsappRules.id))
    .leftJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id));

type MessageRow = Awaited<ReturnType<ReturnType<typeof selectMessageRows>["where"]>>[number];

/** The text a manual send opens with — the template's CURRENT text. */
const manualTextFor = (
  row: MessageRow,
  clinic: { name: string; phone: string | null },
) => {
  const values = chipValuesFrom(
    buildMessageParams({
      firstName: row.patient.firstName,
      startsAt: row.forStartsAt,
      clinicName: clinic.name,
      clinicPhone: clinic.phone ?? "",
    }),
  );
  return row.template?.body
    ? renderCanonical(
        { body: row.template.body, variables: row.template.variables as MessageChip[] },
        values,
      )
    : renderSegments(DEFAULT_BODIES[row.event as WhatsappEvent], values);
};

const refusalFor = (row: MessageRow) =>
  manualSendRefusal({
    event: row.event as WhatsappEvent,
    status: row.status as WhatsappMessageStatus,
    forStartsAt: row.forStartsAt,
    appointment: row.appointment,
    consent: row.patient.consent,
    phone: row.patient.phone,
  });

/**
 * What a list may show of a row — masked number, never the full one. A
 * `waLink` only where a manual send is offered in this mode (33b): every
 * row in manual mode, only rows to rescue otherwise.
 */
const toListRow = (
  row: MessageRow,
  clinic: { name: string; phone: string | null },
  mode: WhatsappMode,
) => {
  const number = toWhatsAppNumber(row.patient.phone);
  const manualAllowed =
    manualSendOffered({
      mode,
      status: row.status as WhatsappMessageStatus,
      skipReason: row.skipReason,
    }) &&
    refusalFor(row) === null &&
    number.ok;
  return {
    key: row.id,
    messageId: row.id as string | null,
    appointmentId: row.appointment.id,
    startsAt: row.appointment.startsAt,
    appointmentStatus: row.appointment.status,
    patient: { id: row.patient.id, name: formatPatientName(row.patient) },
    phoneMasked: maskPhone(row.patient.phone),
    practitioner: row.practitioner?.name ?? null,
    event: row.event as WhatsappEvent | null,
    status: row.status as WhatsappMessageStatus | null,
    skipReason: row.skipReason,
    unscheduledReason: null as UnscheduledReason | null,
    scheduledFor: row.scheduledFor as Date | null,
    sentAt: row.sentAt ?? row.openedAt,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    channel: row.channel,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    waLink:
      manualAllowed && number.ok
        ? waMeLink(number.digits, manualTextFor(row, clinic))
        : null,
    canRetry: canRetry(row.status as WhatsappMessageStatus, row.errorCode),
  };
};

/** The two ends of a journal range, "" ⇒ the last 7 clinic days. */
const resolveJournalRange = (from: string, to: string, now: Date) => {
  const today = toClinicDate(now);
  const end = to || today;
  const start = from || addCalendarDays(end, -(JOURNAL_DEFAULT_DAYS - 1));
  if (start > end) throw badRequest(WHATSAPP_ERRORS.rangeOrder);
  if (addCalendarDays(start, JOURNAL_MAX_RANGE_DAYS - 1) < end) {
    throw badRequest(WHATSAPP_ERRORS.rangeTooLong);
  }
  return { from: start, to: end, range: calendarDateRange(start, end) };
};

const likePattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

const countsSince = (since: Date) =>
  db
    .select({ status: whatsappMessages.status, count: count() })
    .from(whatsappMessages)
    .where(
      gte(sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.scheduledFor})`, since),
    )
    .groupBy(whatsappMessages.status);

const toCounts = (rows: { status: string; count: number }[]) =>
  Object.fromEntries(
    STATUS_VALUES.map((status) => [
      status,
      rows.find((row) => row.status === status)?.count ?? 0,
    ]),
  ) as Record<WhatsappMessageStatus, number>;

const readRules = () =>
  db
    .select({
      id: whatsappRules.id,
      templateId: whatsappRules.templateId,
      event: whatsappRules.event,
      offsetMinutes: whatsappRules.offsetMinutes,
      enabled: whatsappRules.enabled,
    })
    .from(whatsappRules);

/** Still-scheduled rows of a rule become `canceled` (superseded). */
const supersedeRuleRows = (ruleId: string) =>
  db
    .update(whatsappMessages)
    .set({ status: "canceled", skipReason: "superseded", updatedAt: new Date() })
    .where(
      and(
        eq(whatsappMessages.ruleId, ruleId),
        eq(whatsappMessages.status, "scheduled"),
      ),
    );

const ruleSummary = (
  verb: string,
  templateName: string,
  event: WhatsappEvent,
  offsetMinutes: number,
) =>
  `${verb} la règle WhatsApp « ${templateName} » (${EVENT_LABELS[event]}, ${formatTiming(event, offsetMinutes)})`;

// ── Templates: shared (prompts/33b) ─────────────────────────────────────────

/**
 * The stored body as the editor's text and chips. A body that cannot be read
 * back (damaged data) shows as its plain text without placeholders, so the
 * admin can rewrite it — never as a crash, never with braces.
 */
const segmentsOf = (template: { body: string; variables: unknown }): BodySegment[] => {
  try {
    return fromCanonical({
      body: template.body,
      variables: template.variables as MessageChip[],
    });
  } catch (error) {
    if (!(error instanceof MalformedBodyError)) throw error;
    return [{ type: "text", text: template.body.replace(/\{\{\d+\}\}|[{}]/g, "") }];
  }
};

/** The schema already validated the segments; this only converts them. */
const canonicalOrThrow = (segments: BodySegment[]) => {
  try {
    return toCanonical(segments);
  } catch {
    throw badRequest(WHATSAPP_VALIDATION.bodyInvalid);
  }
};

/** Submission needs a real sender's credentials; the sandbox has no templates. */
const assertSubmissionAvailable = () => {
  const twilio = readWhatsappEnv().twilio;
  const availability = submissionAvailability(twilio);
  if (availability === "sandbox") throw badRequest(WHATSAPP_ERRORS.approvalSandbox);
  if (availability === "unavailable" || !twilio) {
    throw badRequest(WHATSAPP_ERRORS.approvalUnavailable);
  }
  return twilio;
};

/** The activity line of one submission — the provider's code if it failed. */
const logSubmission = (
  staffId: string,
  templateId: string,
  name: string,
  outcome: Awaited<ReturnType<typeof submitTemplateForApproval>>,
) =>
  outcome.submitted
    ? logWhatsapp(
        staffId,
        templateId,
        ActivityAction.Updated,
        `Modèle WhatsApp « ${name} » envoyé pour validation`,
      )
    : "failure" in outcome
      ? logWhatsapp(
          staffId,
          templateId,
          ActivityAction.Updated,
          `Échec de l’envoi pour validation du modèle WhatsApp « ${name} » (code ${outcome.failure.code})`,
        )
      : Promise.resolve();

/** Submits one template; a provider failure becomes a French error. */
const submitOrThrow = async (templateId: string, name: string, staffId: string) => {
  const twilio = assertSubmissionAvailable();
  const outcome = await submitTemplateForApproval(templateId, contentApiFor(twilio));
  await logSubmission(staffId, templateId, name, outcome);
  if ("failure" in outcome) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: WHATSAPP_ERRORS.approvalFailed });
  }
  return { status: outcome.status };
};

// ── Router ──────────────────────────────────────────────────────────────────

export const whatsappRouter = createTRPCRouter({
  /**
   * «Rappels»: the day's messages, plus every appointment of the day that
   * has none («Non planifié», with why), so the list is complete. `day` ""
   * ⇒ tomorrow on the clinic clock — resolved here, so the page's prefetch
   * and the view's query share one key.
   */
  getByDay: protectedProcedure.input(byDaySchema).query(async ({ input }) => {
    const now = new Date();
    const day = input.day || addCalendarDays(toClinicDate(now), 1);
    const range = calendarDateRange(day, day);
    const inDay = and(
      gte(appointments.startsAt, range.start),
      lt(appointments.startsAt, range.end),
    );

    const [messages, dayAppointments, settings, clinic, [ruleCount]] =
      await Promise.all([
        selectMessageRows()
          .where(inDay)
          .orderBy(asc(appointments.startsAt), asc(whatsappMessages.scheduledFor)),
        db
          .select({
            id: appointments.id,
            status: appointments.status,
            startsAt: appointments.startsAt,
            patient: {
              id: patients.id,
              firstName: patients.firstName,
              lastName: patients.lastName,
              phone: patients.phone,
              consent: patients.whatsappConsent,
            },
            practitioner: { name: user.name },
          })
          .from(appointments)
          .innerJoin(patients, eq(appointments.patientId, patients.id))
          .leftJoin(user, eq(appointments.practitionerId, user.id))
          .where(and(inDay, ne(appointments.status, "canceled")))
          .orderBy(asc(appointments.startsAt), asc(appointments.id)),
        readSettings(),
        readClinic(),
        db
          .select({ count: count() })
          .from(whatsappRules)
          .where(eq(whatsappRules.enabled, true)),
      ]);

    const withRows = new Set(messages.map((row) => row.appointment.id));
    const unscheduled = dayAppointments
      .filter((appointment) => !withRows.has(appointment.id))
      .map((appointment) => {
        const number = toWhatsAppNumber(appointment.patient.phone);
        const reason = !number.ok
          ? number.reason === "fixe"
            ? UnscheduledReason.Landline
            : UnscheduledReason.InvalidPhone
          : appointment.patient.consent === WhatsappConsent.Declined
            ? UnscheduledReason.NoConsent
            : UnscheduledReason.NoRule;
        return {
          key: `appointment-${appointment.id}`,
          messageId: null as string | null,
          appointmentId: appointment.id,
          startsAt: appointment.startsAt,
          appointmentStatus: appointment.status,
          patient: {
            id: appointment.patient.id,
            name: formatPatientName(appointment.patient),
          },
          phoneMasked: maskPhone(appointment.patient.phone),
          practitioner: appointment.practitioner?.name ?? null,
          event: null as WhatsappEvent | null,
          status: null as WhatsappMessageStatus | null,
          skipReason: null,
          unscheduledReason: reason as UnscheduledReason | null,
          scheduledFor: null as Date | null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          channel: null,
          errorCode: null,
          errorMessage: null,
          waLink: null as string | null,
          canRetry: false,
        };
      });

    const { whatsappEnv, mode } = currentMode(settings.enabled);
    const items = [...messages.map((row) => toListRow(row, clinic, mode)), ...unscheduled].sort(
      (a, b) =>
        a.startsAt.getTime() - b.startsAt.getTime() ||
        (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
    );

    const has = (...statuses: WhatsappMessageStatus[]) =>
      items.filter((item) => item.status && statuses.includes(item.status)).length;

    return {
      day,
      mode,
      // Manual mode has two causes the page words differently: never
      // connected, or connected with the switch off.
      connected: whatsappEnv.complete,
      hasRules: ruleCount.count > 0,
      items,
      counts: {
        scheduled: has(WhatsappMessageStatus.Scheduled, WhatsappMessageStatus.Sending),
        sent: has(WhatsappMessageStatus.Sent, WhatsappMessageStatus.ManualOpened),
        delivered: has(WhatsappMessageStatus.Delivered),
        read: has(WhatsappMessageStatus.Read),
        attention: has(WhatsappMessageStatus.NeedsAttention, WhatsappMessageStatus.Failed),
      },
    };
  }),

  /** The latest message about one appointment — its details' badge. */
  getLatestForAppointment: protectedProcedure
    .input(appointmentIdSchema)
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          event: whatsappMessages.event,
          status: whatsappMessages.status,
          skipReason: whatsappMessages.skipReason,
          scheduledFor: whatsappMessages.scheduledFor,
        })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.appointmentId, input.appointmentId))
        .orderBy(desc(whatsappMessages.updatedAt), desc(whatsappMessages.createdAt))
        .limit(1);
      return row
        ? {
            ...row,
            event: row.event as WhatsappEvent,
            status: row.status as WhatsappMessageStatus,
          }
        : null;
    }),

  /** «À vérifier» for the next 48 h — 0 in manual mode. */
  getAttentionCount: protectedProcedure.query(async () => {
    const [[result], settings] = await Promise.all([
      attentionCountQuery(new Date()),
      readSettings(),
    ]);
    const { mode } = currentMode(settings.enabled);
    return { count: mode === WhatsappMode.Manual ? 0 : result.count, mode };
  }),

  /**
   * Opens a message by hand: records `manual_opened`, the staff member and
   * the time, and returns the `wa.me` link. Refused when the appointment no
   * longer needs it, the patient declined, or the number is not a mobile.
   */
  openManual: protectedProcedure
    .input(messageIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [[row], clinic, settings] = await Promise.all([
        selectMessageRows().where(eq(whatsappMessages.id, input.id)).limit(1),
        readClinic(),
        readSettings(),
      ]);
      if (!row) throw notFound(WHATSAPP_ERRORS.messageNotFound);

      // The list and the action agree: a healthy automatic row is not sent by hand.
      if (
        !manualSendOffered({
          mode: currentMode(settings.enabled).mode,
          status: row.status as WhatsappMessageStatus,
          skipReason: row.skipReason,
        })
      ) {
        throw badRequest(WHATSAPP_ERRORS.manualNotNeeded);
      }

      const refusal = refusalFor(row);
      if (refusal) throw badRequest(refusal);
      const number = toWhatsAppNumber(row.patient.phone);
      if (!number.ok) throw badRequest(WHATSAPP_ERRORS.invalidPhone);

      const now = new Date();
      const openable = and(
        eq(whatsappMessages.id, row.id),
        notInArray(whatsappMessages.status, [
          "sending",
          "sent",
          "delivered",
          "read",
          "canceled",
        ]),
      );
      const [, opened] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.Whatsapp,
            entityId: row.id,
            action: ActivityAction.Generated,
            patientId: row.patient.id,
            summary: `Message WhatsApp « ${EVENT_LABELS[row.event as WhatsappEvent]} » ouvert manuellement pour ${formatPatientName(row.patient)}`,
            staffId: ctx.auth.user.id,
          },
          { table: whatsappMessages, where: openable },
        ),
        db
          .update(whatsappMessages)
          .set({
            status: "manual_opened",
            channel: "manual_link",
            openedAt: now,
            openedByStaffId: ctx.auth.user.id,
            updatedAt: now,
          })
          .where(openable)
          .returning({ id: whatsappMessages.id }),
      ]);
      if (opened.length === 0) throw badRequest(WHATSAPP_ERRORS.manualNotAllowed);

      return { url: waMeLink(number.digits, manualTextFor(row, clinic)) };
    }),

  /**
   * «Réessayer»: a `failed` row with a retryable code, or a `needs_attention`
   * row, goes back to `scheduled` now — and through the send-time check again.
   */
  retry: protectedProcedure
    .input(messageIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [row] = await selectMessageRows()
        .where(eq(whatsappMessages.id, input.id))
        .limit(1);
      if (!row) throw notFound(WHATSAPP_ERRORS.messageNotFound);
      if (!canRetry(row.status as WhatsappMessageStatus, row.errorCode)) {
        throw badRequest(WHATSAPP_ERRORS.retryNotAllowed);
      }

      const now = new Date();
      const retryable = and(
        eq(whatsappMessages.id, row.id),
        eq(whatsappMessages.status, row.status),
      );
      const [, updated] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.Whatsapp,
            entityId: row.id,
            action: ActivityAction.Updated,
            patientId: row.patient.id,
            summary: `Message WhatsApp « ${EVENT_LABELS[row.event as WhatsappEvent]} » replanifié pour ${formatPatientName(row.patient)}`,
            staffId: ctx.auth.user.id,
          },
          { table: whatsappMessages, where: retryable },
        ),
        db
          .update(whatsappMessages)
          .set({
            status: "scheduled",
            scheduledFor: now,
            attempts: 0,
            providerMessageId: null,
            errorCode: null,
            errorMessage: null,
            claimedAt: null,
            updatedAt: now,
          })
          .where(retryable)
          .returning({ id: whatsappMessages.id }),
      ]);
      if (updated.length === 0) throw badRequest(WHATSAPP_ERRORS.retryNotAllowed);
      return { id: row.id };
    }),

  // ── Admin: journal and service status ─────────────────────────────────────

  getJournal: adminProcedure.input(journalSchema).query(async ({ input }) => {
    const now = new Date();
    const { from, to, range } = resolveJournalRange(input.from, input.to, now);
    const at = sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.scheduledFor})`;
    const search = input.q.trim();

    const where = and(
      gte(at, range.start),
      lt(at, range.end),
      input.event ? eq(whatsappMessages.event, input.event) : undefined,
      input.status ? eq(whatsappMessages.status, input.status) : undefined,
      search
        ? or(
            ilike(patients.lastName, likePattern(search)),
            ilike(patients.firstName, likePattern(search)),
            ilike(patients.shortCode, likePattern(search)),
          )
        : undefined,
    );

    const offset = (input.page - 1) * JOURNAL_PAGE_SIZE;
    const [rows, [totals], clinic, settings] = await Promise.all([
      selectMessageRows()
        .where(where)
        .orderBy(desc(at), desc(whatsappMessages.id))
        .limit(JOURNAL_PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: count() })
        .from(whatsappMessages)
        .innerJoin(appointments, eq(whatsappMessages.appointmentId, appointments.id))
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .where(where),
      readClinic(),
      readSettings(),
    ]);
    const { mode } = currentMode(settings.enabled);

    return {
      from,
      to,
      items: rows.map((row) => ({
        ...toListRow(row, clinic, mode),
        // The journal never opens WhatsApp: that is «Rappels»' job.
        waLink: null,
        at: row.sentAt ?? row.scheduledFor,
      })),
      total: totals.count,
      totalPages: Math.ceil(totals.count / JOURNAL_PAGE_SIZE),
    };
  }),

  getServiceStatus: adminProcedure.query(async () => {
    const now = new Date();
    const [settings, clinic, last24h, last7d] = await Promise.all([
      readSettings(),
      readClinic(),
      countsSince(new Date(now.getTime() - 24 * 3_600_000)),
      countsSince(new Date(now.getTime() - 7 * 24 * 3_600_000)),
    ]);
    const { whatsappEnv, mode } = currentMode(settings.enabled);
    const connected = isEnvComplete(whatsappEnv.presence);
    const sandboxSender = whatsappEnv.twilio?.sandbox ?? false;

    return {
      mode,
      enabled: settings.enabled,
      connected,
      sandboxSender,
      // The sender as a person reads it — never a credential.
      senderNumber: connected ? formatSenderNumber(whatsappEnv.from) : null,
      clinicPhonePresent: clinic.phone !== null,
      // 33b: templates are submitted for approval with a real sender only.
      templateSubmission: submissionAvailability(whatsappEnv.twilio),
      // Rules warn about unapproved templates where approval will matter.
      approvalRequired: connected && !sandboxSender,
      // «Diagnostic technique» only. Booleans for the env — never a value.
      diagnostic: {
        env: ENV_KEYS.map((key) => ({ key, present: whatsappEnv.presence[key] })),
        webhookUrl: webhookUrl(),
        lastCron: settings.lastCronAt
          ? {
              at: settings.lastCronAt,
              claimed: settings.lastCronClaimed,
              sent: settings.lastCronSent,
              failed: settings.lastCronFailed,
              needsAttention: settings.lastCronNeedsAttention,
            }
          : null,
        counts24h: toCounts(last24h),
        counts7d: toCounts(last7d),
      },
    };
  }),

  // ── Admin: settings ───────────────────────────────────────────────────────

  getSettings: adminProcedure.query(async () => {
    const settings = await readSettings();
    return {
      enabled: settings.enabled,
      ...toSendWindow(settings),
    };
  }),

  /**
   * The switch, the window and the minimum lead. Turning the switch on needs
   * a complete env and the clinic phone, and runs the backfill; a new window
   * or lead re-plans every still-scheduled row.
   */
  updateSettings: adminProcedure
    .input(settingsUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const [before, clinic] = await Promise.all([readSettings(), readClinic()]);
      const { whatsappEnv } = currentMode(input.enabled);

      if (input.enabled && !before.enabled) {
        if (!isEnvComplete(whatsappEnv.presence)) {
          throw badRequest(WHATSAPP_ERRORS.notConnected);
        }
        if (!clinic.phone) throw badRequest(WHATSAPP_ERRORS.clinicPhoneMissing);
      }

      const now = new Date();
      const previousWindow = toSendWindow(before);
      const windowChanged =
        previousWindow.windowStart !== input.windowStart ||
        previousWindow.windowEnd !== input.windowEnd ||
        previousWindow.minLeadMinutes !== input.minLeadMinutes;

      const summary =
        input.enabled !== before.enabled
          ? input.enabled
            ? "Envois WhatsApp automatiques activés"
            : "Envois WhatsApp automatiques désactivés"
          : `Réglages WhatsApp modifiés (heures d’envoi ${input.windowStart}–${input.windowEnd}, délai minimum ${input.minLeadMinutes / 60} h)`;

      try {
        await db.batch([
          db
            .update(whatsappSettings)
            .set({
              enabled: input.enabled,
              windowStart: toPgTime(input.windowStart),
              windowEnd: toPgTime(input.windowEnd),
              minLeadMinutes: input.minLeadMinutes,
              updatedByStaffId: ctx.auth.user.id,
              updatedAt: now,
            })
            .where(eq(whatsappSettings.id, before.id)),
          logWhatsapp(ctx.auth.user.id, SETTINGS_ID, ActivityAction.Updated, summary),
        ]);
      } catch (error) {
        if (postgresErrorCode(error) === "23514") {
          throw badRequest(WHATSAPP_ERRORS.rangeOrder);
        }
        throw error;
      }

      const context = await loadMessagingContext();
      if (windowChanged) await replanScheduledRows(context, now);
      const backfilled =
        input.enabled && !before.enabled ? await backfillReminders(context, now) : 0;

      return { backfilled };
    }),

  // ── Admin: templates (prompts/33b) ────────────────────────────────────────

  /**
   * The templates as the editor reads them: the message as text and chips
   * (never the placeholder body, never a resource id), the approval status,
   * a French rejection reason, and whether an approved version is active.
   */
  getTemplates: adminProcedure.query(async () => {
    const [templates, rules, clinic] = await Promise.all([
      db
        .select()
        .from(whatsappTemplates)
        .orderBy(asc(whatsappTemplates.kind), asc(whatsappTemplates.name)),
      readRules(),
      readClinic(),
    ]);
    const used = new Set(rules.map((rule) => rule.templateId));
    return {
      // The preview shows the clinic's real name and phone (decision 5).
      preview: {
        [MessageChip.ClinicName]: clinic.name,
        ...(clinic.phone ? { [MessageChip.ClinicPhone]: formatClinicPhone(clinic.phone) } : {}),
      },
      items: templates.map((template) => ({
        id: template.id,
        name: template.name,
        kind: template.kind as WhatsappEvent,
        isActive: template.isActive,
        isUsed: used.has(template.id),
        segments: segmentsOf(template),
        approvalStatus: template.approvalStatus as TemplateApproval,
        rejectionReason:
          template.approvalStatus === TemplateApproval.Rejected
            ? rejectionReasonLabel(template.rejectionReason)
            : null,
        submittedAt: template.submittedAt,
        approvedAt: template.approvedAt,
        hasApprovedVersion: template.activeContentSid !== null,
      })),
    };
  }),

  /** «Enregistrer» / «Enregistrer et envoyer pour validation». */
  createTemplate: adminProcedure
    .input(templateCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const { submit, segments, ...values } = input;
      if (submit) assertSubmissionAvailable();
      const canonical = canonicalOrThrow(segments);

      const id = nanoid();
      try {
        await db.batch([
          db.insert(whatsappTemplates).values({
            id,
            ...values,
            body: canonical.body,
            variables: canonical.variables,
            approvalStatus: TemplateApproval.Draft,
          }),
          logWhatsapp(
            ctx.auth.user.id,
            id,
            ActivityAction.Created,
            `Modèle WhatsApp « ${values.name} » créé`,
          ),
        ]);
      } catch (error) {
        if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
          throw new TRPCError({ code: "CONFLICT", message: WHATSAPP_ERRORS.templateNameTaken });
        }
        throw error;
      }

      if (submit) await submitOrThrow(id, values.name, ctx.auth.user.id);
      return { id };
    }),

  /**
   * A new text becomes a new draft; the approved version, if any, keeps
   * sending until its replacement is approved (decision 6). A name, kind or
   * «Actif» change alone leaves the approval as it is.
   */
  updateTemplate: adminProcedure
    .input(templateUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, submit, segments, ...values } = input;
      if (submit) assertSubmissionAvailable();
      const canonical = canonicalOrThrow(segments);

      const [[existing], rules] = await Promise.all([
        db.select().from(whatsappTemplates).where(eq(whatsappTemplates.id, id)).limit(1),
        readRules(),
      ]);
      if (!existing) throw notFound(WHATSAPP_ERRORS.templateNotFound);

      const kindError = templateKindChangeError(
        { id, kind: existing.kind as WhatsappEvent },
        values.kind,
        rules,
      );
      if (kindError) throw badRequest(kindError);

      const bodyChanged = !sameCanonical(canonical, {
        body: existing.body,
        variables: existing.variables as MessageChip[],
      });

      try {
        await db.batch([
          db
            .update(whatsappTemplates)
            .set({
              ...values,
              body: canonical.body,
              variables: canonical.variables,
              ...editPatch(bodyChanged),
              updatedAt: new Date(),
            })
            .where(eq(whatsappTemplates.id, id)),
          logWhatsapp(
            ctx.auth.user.id,
            id,
            ActivityAction.Updated,
            `Modèle WhatsApp « ${values.name} » modifié`,
          ),
        ]);
      } catch (error) {
        const code = postgresErrorCode(error);
        if (code === UNIQUE_VIOLATION) {
          throw new TRPCError({ code: "CONFLICT", message: WHATSAPP_ERRORS.templateNameTaken });
        }
        // A rule was attached meanwhile: the composite key refuses the kind change.
        if (code === FOREIGN_KEY_VIOLATION) throw badRequest(WHATSAPP_ERRORS.templateKindInUse);
        throw error;
      }

      if (submit) await submitOrThrow(id, values.name, ctx.auth.user.id);
      return { id };
    }),

  /** «Envoyer pour validation» / «Corriger et renvoyer» — idempotent. */
  submitTemplate: adminProcedure
    .input(templateIdSchema)
    .mutation(async ({ input, ctx }) => {
      assertSubmissionAvailable();
      const [template] = await db
        .select({ name: whatsappTemplates.name })
        .from(whatsappTemplates)
        .where(eq(whatsappTemplates.id, input.id))
        .limit(1);
      if (!template) throw notFound(WHATSAPP_ERRORS.templateNotFound);
      return submitOrThrow(input.id, template.name, ctx.auth.user.id);
    }),

  /**
   * «Envoyer tous les modèles pour validation»: every active draft, one by
   * one. Idempotent — a template already pending or approved is skipped, and
   * a second click finds no draft left.
   */
  submitAllDrafts: adminProcedure.mutation(async ({ ctx }) => {
    const twilio = assertSubmissionAvailable();
    const drafts = await db
      .select({ id: whatsappTemplates.id, name: whatsappTemplates.name })
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.approvalStatus, TemplateApproval.Draft),
          eq(whatsappTemplates.isActive, true),
        ),
      )
      .orderBy(asc(whatsappTemplates.kind), asc(whatsappTemplates.name));

    const api = contentApiFor(twilio);
    let submitted = 0;
    let failed = 0;
    for (const draft of drafts) {
      const outcome = await submitTemplateForApproval(draft.id, api);
      if (outcome.submitted) submitted++;
      if ("failure" in outcome) failed++;
      await logSubmission(ctx.auth.user.id, draft.id, draft.name, outcome);
    }
    return { submitted, failed };
  }),

  /** «Actualiser», and the Modèles tab on open: the pending verdicts now. */
  refreshTemplateStatuses: adminProcedure.mutation(async () => {
    const twilio = readWhatsappEnv().twilio;
    if (submissionAvailability(twilio) !== "available") {
      return { checked: 0, approved: 0, rejected: 0, errors: 0, released: 0 };
    }
    const summary = await refreshTemplateStatuses(contentApiFor(twilio!));
    if (summary.checked > 0 && summary.errors === summary.checked) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: WHATSAPP_ERRORS.approvalRefreshFailed,
      });
    }
    return summary;
  }),

  removeTemplate: adminProcedure
    .input(templateIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [[existing], rules] = await Promise.all([
        db
          .select({ id: whatsappTemplates.id, name: whatsappTemplates.name })
          .from(whatsappTemplates)
          .where(eq(whatsappTemplates.id, input.id))
          .limit(1),
        readRules(),
      ]);
      if (!existing) throw notFound(WHATSAPP_ERRORS.templateNotFound);
      const inUse = templateRemovalError(input.id, rules);
      if (inUse) throw badRequest(inUse);

      try {
        await db.batch([
          db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, input.id)),
          logWhatsapp(
            ctx.auth.user.id,
            input.id,
            ActivityAction.Deleted,
            `Modèle WhatsApp « ${existing.name} » supprimé`,
          ),
        ]);
      } catch (error) {
        // RESTRICT: a rule was attached between the check and the delete.
        if (postgresErrorCode(error) === FOREIGN_KEY_VIOLATION) {
          throw badRequest(WHATSAPP_ERRORS.templateInUse);
        }
        throw error;
      }
      return { id: input.id };
    }),

  // ── Admin: rules ──────────────────────────────────────────────────────────

  listRules: adminProcedure.query(async () => {
    const items = await db
      .select({
        id: whatsappRules.id,
        event: whatsappRules.event,
        offsetMinutes: whatsappRules.offsetMinutes,
        enabled: whatsappRules.enabled,
        template: {
          id: whatsappTemplates.id,
          name: whatsappTemplates.name,
          isActive: whatsappTemplates.isActive,
          // Whether the rule can send in automatic mode (33b) — a boolean,
          // never the resource id.
          hasApprovedVersion: sql<boolean>`${whatsappTemplates.activeContentSid} IS NOT NULL`,
        },
      })
      .from(whatsappRules)
      .innerJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id))
      .orderBy(
        sql`array_position(ARRAY['reminder','confirmation','reschedule','cancellation']::whatsapp_event[], ${whatsappRules.event})`,
        desc(whatsappRules.offsetMinutes),
      );
    return {
      items: items.map((rule) => ({ ...rule, event: rule.event as WhatsappEvent })),
    };
  }),

  createRule: adminProcedure
    .input(ruleFormSchema)
    .mutation(async ({ input, ctx }) => {
      const [[template], rules] = await Promise.all([
        db
          .select()
          .from(whatsappTemplates)
          .where(eq(whatsappTemplates.id, input.templateId))
          .limit(1),
        readRules(),
      ]);
      if (!template) throw notFound(WHATSAPP_ERRORS.templateNotFound);
      if (!template.isActive) throw badRequest(WHATSAPP_ERRORS.templateInactive);

      // The event is the template's kind — never the client's.
      const event = ruleEventFor({ kind: template.kind as WhatsappEvent });
      const offsetMinutes = input.value * unitMinutes(input.unit);
      if (!isOffsetValid(event, offsetMinutes)) {
        throw badRequest(
          event === WhatsappEvent.Reminder
            ? WHATSAPP_VALIDATION.offsetReminder
            : WHATSAPP_VALIDATION.offsetDelay,
        );
      }
      const constraint = ruleConstraintError(
        rules.map((rule) => ({ ...rule, event: rule.event as WhatsappEvent })),
        { event, offsetMinutes },
      );
      if (constraint) throw badRequest(constraint);

      const id = nanoid();
      try {
        await db.batch([
          db.insert(whatsappRules).values({
            id,
            templateId: template.id,
            event,
            offsetMinutes,
            enabled: input.enabled,
          }),
          logWhatsapp(
            ctx.auth.user.id,
            id,
            ActivityAction.Created,
            ruleSummary("Ajout de", template.name, event, offsetMinutes),
          ),
        ]);
      } catch (error) {
        if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
          throw badRequest(
            event === WhatsappEvent.Reminder
              ? WHATSAPP_ERRORS.duplicateReminderOffset
              : WHATSAPP_ERRORS.ruleExistsForEvent,
          );
        }
        throw error;
      }

      // A new reminder rule covers the appointments already booked.
      if (input.enabled && event === WhatsappEvent.Reminder) {
        await backfillReminders(await loadMessagingContext(), new Date(), id);
      }
      return { id };
    }),

  /**
   * A new template or timing: the rule's still-scheduled rows are canceled
   * (superseded) and, for a reminder, planned again for future appointments.
   */
  updateRule: adminProcedure
    .input(ruleUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const [[existing], [template], rules] = await Promise.all([
        db.select().from(whatsappRules).where(eq(whatsappRules.id, input.id)).limit(1),
        db
          .select()
          .from(whatsappTemplates)
          .where(eq(whatsappTemplates.id, input.templateId))
          .limit(1),
        readRules(),
      ]);
      if (!existing) throw notFound(WHATSAPP_ERRORS.ruleNotFound);
      if (!template) throw notFound(WHATSAPP_ERRORS.templateNotFound);

      const event = ruleEventFor({ kind: template.kind as WhatsappEvent });
      const offsetMinutes = input.value * unitMinutes(input.unit);
      if (!isOffsetValid(event, offsetMinutes)) {
        throw badRequest(
          event === WhatsappEvent.Reminder
            ? WHATSAPP_VALIDATION.offsetReminder
            : WHATSAPP_VALIDATION.offsetDelay,
        );
      }
      const constraint = ruleConstraintError(
        rules.map((rule) => ({ ...rule, event: rule.event as WhatsappEvent })),
        { id: input.id, event, offsetMinutes },
      );
      if (constraint) throw badRequest(constraint);

      const changed =
        existing.templateId !== template.id ||
        existing.event !== event ||
        existing.offsetMinutes !== offsetMinutes ||
        existing.enabled !== input.enabled;

      try {
        await db.batch([
          db
            .update(whatsappRules)
            .set({
              templateId: template.id,
              event,
              offsetMinutes,
              enabled: input.enabled,
              updatedAt: new Date(),
            })
            .where(eq(whatsappRules.id, input.id)),
          logWhatsapp(
            ctx.auth.user.id,
            input.id,
            ActivityAction.Updated,
            ruleSummary("Modification de", template.name, event, offsetMinutes),
          ),
          // Rows planned for the old timing or template are superseded, in
          // the same transaction; the reminder backfill below re-plans them.
          ...(changed ? [supersedeRuleRows(input.id)] : []),
        ]);
      } catch (error) {
        if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
          throw badRequest(
            event === WhatsappEvent.Reminder
              ? WHATSAPP_ERRORS.duplicateReminderOffset
              : WHATSAPP_ERRORS.ruleExistsForEvent,
          );
        }
        throw error;
      }

      if (changed && input.enabled && event === WhatsappEvent.Reminder) {
        await backfillReminders(await loadMessagingContext(), new Date(), input.id);
      }
      return { id: input.id };
    }),

  /** The table's switch. Off cancels the rule's pending rows. */
  toggleRule: adminProcedure
    .input(ruleToggleSchema)
    .mutation(async ({ input, ctx }) => {
      const [rule] = await db
        .select({
          id: whatsappRules.id,
          event: whatsappRules.event,
          offsetMinutes: whatsappRules.offsetMinutes,
          templateName: whatsappTemplates.name,
        })
        .from(whatsappRules)
        .innerJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id))
        .where(eq(whatsappRules.id, input.id))
        .limit(1);
      if (!rule) throw notFound(WHATSAPP_ERRORS.ruleNotFound);
      const event = rule.event as WhatsappEvent;

      await db.batch([
        db
          .update(whatsappRules)
          .set({ enabled: input.enabled, updatedAt: new Date() })
          .where(eq(whatsappRules.id, rule.id)),
        ...(input.enabled ? [] : [supersedeRuleRows(rule.id)]),
        logWhatsapp(
          ctx.auth.user.id,
          rule.id,
          ActivityAction.Updated,
          ruleSummary(
            input.enabled ? "Activation de" : "Désactivation de",
            rule.templateName,
            event,
            rule.offsetMinutes,
          ),
        ),
      ]);

      if (input.enabled && event === WhatsappEvent.Reminder) {
        await backfillReminders(await loadMessagingContext(), new Date(), rule.id);
      }
      return { id: rule.id };
    }),

  removeRule: adminProcedure
    .input(messageIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [rule] = await db
        .select({
          id: whatsappRules.id,
          event: whatsappRules.event,
          offsetMinutes: whatsappRules.offsetMinutes,
          templateName: whatsappTemplates.name,
        })
        .from(whatsappRules)
        .innerJoin(whatsappTemplates, eq(whatsappRules.templateId, whatsappTemplates.id))
        .where(eq(whatsappRules.id, input.id))
        .limit(1);
      if (!rule) throw notFound(WHATSAPP_ERRORS.ruleNotFound);

      // Pending rows first (superseded), then the rule: its sent rows keep
      // their history with `rule_id` set null.
      await db.batch([
        supersedeRuleRows(rule.id),
        db.delete(whatsappRules).where(eq(whatsappRules.id, rule.id)),
        logWhatsapp(
          ctx.auth.user.id,
          rule.id,
          ActivityAction.Deleted,
          ruleSummary(
            "Suppression de",
            rule.templateName,
            rule.event as WhatsappEvent,
            rule.offsetMinutes,
          ),
        ),
      ]);
      return { id: rule.id };
    }),

  // ── Admin: actions ────────────────────────────────────────────────────────

  /**
   * Sends one event's message, with sample values, to the given number
   * through the REAL provider, and answers Twilio's outcome as is. Logs the
   * masked number only.
   */
  sendTest: adminProcedure
    .input(sendTestSchema)
    .mutation(async ({ input, ctx }) => {
      const { whatsappEnv } = currentMode(true);
      if (!whatsappEnv.twilio) throw badRequest(WHATSAPP_ERRORS.notConnected);
      const number = toWhatsAppNumber(input.phone);
      if (!number.ok) throw badRequest(WHATSAPP_ERRORS.invalidPhone);
      const sandbox = whatsappEnv.twilio.sandbox;

      // The template an enabled rule uses for this event, else any active one.
      const [[template], clinic] = await Promise.all([
        db
          .select({
            activeContentSid: whatsappTemplates.activeContentSid,
            activeVariables: whatsappTemplates.activeVariables,
            body: whatsappTemplates.body,
            variables: whatsappTemplates.variables,
          })
          .from(whatsappTemplates)
          .leftJoin(whatsappRules, eq(whatsappRules.templateId, whatsappTemplates.id))
          .where(
            and(
              eq(whatsappTemplates.kind, input.event),
              eq(whatsappTemplates.isActive, true),
            ),
          )
          .orderBy(sql`${whatsappRules.enabled} IS TRUE DESC`, asc(whatsappTemplates.name))
          .limit(1),
        readClinic(),
      ]);

      // Outside the sandbox only an approved resource can go: say so in
      // French rather than let the provider refuse it.
      if (!sandbox && !template?.activeContentSid) {
        throw badRequest(WHATSAPP_ERRORS.testTemplateUnapproved);
      }
      const fallback = toCanonical(DEFAULT_BODIES[input.event]);

      const result = await createTwilioProvider(whatsappEnv.twilio).send({
        to: number.digits,
        template: {
          contentSid: sandbox ? null : (template?.activeContentSid ?? null),
          contentVariables: sandbox
            ? null
            : ((template?.activeVariables as MessageChip[] | null) ?? null),
          body: template?.body ?? fallback.body,
          variables: (template?.variables as MessageChip[] | undefined) ?? fallback.variables,
        },
        params: {
          ...SAMPLE_PARAMS,
          clinicName: clinic.name,
          clinicPhone: clinic.phone ?? SAMPLE_PARAMS.clinicPhone,
        },
        statusCallbackUrl: null,
      });

      await logWhatsapp(
        ctx.auth.user.id,
        SETTINGS_ID,
        ActivityAction.Generated,
        `Message WhatsApp test « ${EVENT_LABELS[input.event]} » envoyé au ${maskPhone(input.phone)} : ${result.ok ? "accepté" : `échec ${result.code}`}`,
      );

      return result.ok
        ? { ok: true as const, messageId: result.messageId }
        : {
            ok: false as const,
            code: result.code,
            message: result.message,
            kind: result.kind,
          };
    }),

  /**
   * The ONE bulk consent path: every `unknown` becomes `granted`, the clinic
   * attesting the patients agreed. One activity line with the count.
   */
  bulkMarkConsent: adminProcedure.mutation(async ({ ctx }) => {
    const unknown = eq(patients.whatsappConsent, "unknown");
    // One batch: the line counts the patients BEFORE the update moves them,
    // in the same transaction — the count and the change cannot disagree.
    const [, updated] = await db.batch([
      logActivity({
        entityType: ActivityEntityType.Whatsapp,
        entityId: SETTINGS_ID,
        action: ActivityAction.Updated,
        patientId: null,
        summary: sql`'Consentement WhatsApp attesté par le cabinet pour ' || (SELECT count(*) FROM ${patients} WHERE ${unknown}) || ' patient(s)'`,
        staffId: ctx.auth.user.id,
      }),
      db
        .update(patients)
        .set({ whatsappConsent: "granted", updatedAt: new Date() })
        .where(unknown)
        .returning({ id: patients.id }),
    ]);
    return { count: updated.length };
  }),

  /** Reminder rows for every future appointment that lacks one. */
  backfill: adminProcedure.mutation(async ({ ctx }) => {
    const created = await backfillReminders(await loadMessagingContext(), new Date());
    await logWhatsapp(
      ctx.auth.user.id,
      SETTINGS_ID,
      ActivityAction.Generated,
      `${created} rappel${created > 1 ? "s" : ""} WhatsApp planifié${created > 1 ? "s" : ""} pour les rendez-vous à venir`,
    );
    return { count: created };
  }),
});
