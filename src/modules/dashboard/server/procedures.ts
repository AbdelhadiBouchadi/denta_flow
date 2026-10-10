import "server-only";

import { asc, count, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/database";
import { hasMedicalAlert } from "@/database/sql/medical-alert";
import {
  appointments,
  appointmentTypes,
  expenses,
  patients,
  payments,
  user,
} from "@/database/schema";
import { chargesColumns, spentInRange } from "@/database/sql/expenses";
import {
  paidInRange,
  receivablesColumns,
  revenueColumns,
} from "@/database/sql/receivables";
import { clinicDayRange, toClinicTime } from "@/lib/time";
import type { AppointmentStatus } from "@/modules/appointments/types";
import { formatPatientName } from "@/modules/patients/derived";
import { remainingCents } from "@/modules/patients/server/procedures";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { periodDates, periodRange } from "../period";
import {
  greetingForHour,
  LATE_AFTER_MINUTES,
  netProfitCents,
  TOP_DEBTORS_LIMIT,
} from "../rules";
import { adminStatsSchema } from "../schemas";
import {
  countWhere,
  isCompleted,
  isDayAppointment,
  isLate,
  isRemaining,
  isWaiting,
} from "./today";

/**
 * `/tableau-de-bord`. Two procedures, split by who may read money
 * (prompts/22, decision 2):
 *
 * - `getStats` — every staff member. The day's agenda, its counts and the
 *   debts to recover. NO clinic revenue of any kind: a secretary's response
 *   carries no such field.
 * - `getAdminStats` — the admin. Revenue, payment count, reste à encaisser,
 *   avances. Refused here, not only hidden.
 *
 * Neither takes a day: the server computes «today» on the clinic clock at
 * each call, so a page left open past midnight shows the new day on its next
 * refetch. No staff scoping anywhere (AGENTS.md §2).
 */

const MINUTE_MS = 60_000;

/** The appointment's length in whole minutes, computed by Postgres. */
const durationMinutes = sql<number>`(EXTRACT(EPOCH FROM (${appointments.endsAt} - ${appointments.startsAt})) / 60)::int`;

export const dashboardRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const today = clinicDayRange(now);
    const lateBefore = new Date(now.getTime() - LATE_AFTER_MINUTES * MINUTE_MS);

    // One round trip: three reads in one `db.batch`. Every count and every
    // balance is computed in SQL.
    const [[counts], rows, debtors] = await db.batch([
      db
        .select({
          todayTotal: count(),
          todayRemaining: countWhere(isRemaining),
          waitingCount: countWhere(isWaiting(today)),
          completedCount: countWhere(isCompleted),
        })
        .from(appointments)
        .where(isDayAppointment(today)),
      db
        .select({
          id: appointments.id,
          startsAt: appointments.startsAt,
          endsAt: appointments.endsAt,
          status: appointments.status,
          durationMinutes,
          isLate: sql<boolean>`COALESCE(${isLate(lateBefore)}, FALSE)`,
          // The boolean only — the allergy text stays in the dossier.
          hasMedicalAlert,
          patient: {
            id: patients.id,
            firstName: patients.firstName,
            lastName: patients.lastName,
            shortCode: patients.shortCode,
          },
          type: {
            label: appointmentTypes.label,
            color: appointmentTypes.color,
          },
          practitioner: { name: user.name },
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(
          appointmentTypes,
          eq(appointments.typeId, appointmentTypes.id),
        )
        .leftJoin(user, eq(appointments.practitionerId, user.id))
        .where(isDayAppointment(today))
        // Same instant for two practitioners: the id keeps the order stable.
        .orderBy(asc(appointments.startsAt), asc(appointments.id)),
      // «Soldes à recouvrer»: positive balances only — a patient in advance
      // never appears. Archived patients included: a debt is a debt.
      db
        .select({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          shortCode: patients.shortCode,
          isArchived: patients.isArchived,
          remainingCents,
        })
        .from(patients)
        .where(gt(remainingCents, 0))
        .orderBy(desc(remainingCents), asc(patients.id))
        .limit(TOP_DEBTORS_LIMIT),
    ]);

    return {
      /** The instant «today» was computed at — the banner's date. */
      asOf: now,
      greeting: greetingForHour(toClinicTime(now).getHours()),
      viewerName: ctx.auth.user.name,
      todayTotal: counts.todayTotal,
      todayRemaining: counts.todayRemaining,
      waitingCount: counts.waitingCount,
      completedCount: counts.completedCount,
      appointments: rows.map(({ patient, status, ...row }) => ({
        ...row,
        // The pgEnum values and the TS enum are kept in lockstep (types.ts).
        status: status as AppointmentStatus,
        patient: {
          id: patient.id,
          name: formatPatientName(patient),
          shortCode: patient.shortCode,
        },
      })),
      topDebtors: debtors.map((debtor) => ({
        id: debtor.id,
        name: formatPatientName(debtor),
        shortCode: debtor.shortCode,
        isArchived: debtor.isArchived,
        remainingCents: debtor.remainingCents,
      })),
    };
  }),

  /**
   * The «Encaissements» block and the revenue card, one query. The period's
   * revenue and today's are the same fragment over two ranges; the balances
   * are the same SQL as `payments.getSummary` — as of now, whatever the
   * period.
   *
   * «Charges» is the same fragment as `expenses.getSummary`
   * (src/database/sql/expenses.ts) over the SAME range object as the
   * revenue, so «Bénéfice net» subtracts two figures bounded identically.
   * The net is `null` when the period has no charge (decision 5).
   */
  getAdminStats: adminProcedure
    .input(adminStatsSchema)
    .query(async ({ input }) => {
      const now = new Date();
      const period = periodDates(input.period, now);
      const range = periodRange(input.period, now);

      const [[periodRevenue], [todayRevenue], [balances], [charges]] =
        await db.batch([
        db
          .select(revenueColumns)
          .from(payments)
          .where(paidInRange(range)),
        db
          .select(revenueColumns)
          .from(payments)
          .where(paidInRange(clinicDayRange(now))),
        db.select(receivablesColumns(remainingCents)).from(patients),
        db.select(chargesColumns).from(expenses).where(spentInRange(range)),
      ]);

      return {
        period: { key: input.period, from: period.from, to: period.to },
        revenueCents: periodRevenue.revenueCents,
        paymentCount: periodRevenue.paymentCount,
        todayRevenueCents: todayRevenue.revenueCents,
        outstandingCents: balances.outstandingCents,
        advancesCents: balances.advancesCents,
        chargesCents: charges.chargesCents,
        expenseCount: charges.expenseCount,
        netCents: netProfitCents({
          revenueCents: periodRevenue.revenueCents,
          chargesCents: charges.chargesCents,
          expenseCount: charges.expenseCount,
        }),
      };
    }),
});
