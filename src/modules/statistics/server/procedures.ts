import "server-only";

import { and, count, eq, inArray, sql, sum } from "drizzle-orm";

import { db } from "@/database";
import {
  appointments,
  expenses,
  insurers,
  patients,
  payments,
  services,
  treatments,
  user,
} from "@/database/schema";
import { isBillableTreatment } from "@/database/sql/billable";
import { chargesColumns, spentInRange } from "@/database/sql/expenses";
import { inInstantRange } from "@/database/sql/range";
import {
  paidInRange,
  receivablesColumns,
  revenueColumns,
} from "@/database/sql/receivables";
import {
  treatmentDate,
  treatmentDateInRange,
} from "@/database/sql/treatment-date";
import type { InstantRange } from "@/lib/time";
import { AppointmentStatus } from "@/modules/appointments/types";
import { netProfitCents } from "@/modules/dashboard/rules";
import { countWhere, isCompleted } from "@/modules/dashboard/server/today";
import { remainingCents } from "@/modules/patients/server/procedures";
import { PaymentMethod } from "@/modules/payments/types";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import {
  buildBuckets,
  buildDaySlots,
  buildHourSlots,
  granularityFor,
  slotClass,
} from "../buckets";
import {
  NO_INSURER_KEY,
  NO_PRACTITIONER_KEY,
  OTHERS_KEY,
  PAYMENT_METHOD_SERIES,
  TOP_ACTES_LIMIT,
  UPCOMING_STATUSES,
} from "../constants";
import { resolvePeriod } from "../period";
import { absenceRate, cancellationRate } from "../rules";
import { statisticsInputSchema, type StatisticsInput } from "../schemas";
import { bucketIndex, byBucket, foldIntoOthers, slotClassOf } from "./sql";

/**
 * `/statistiques` — ADMIN ONLY, every procedure (prompts/30, decision 1):
 * revenue, production, charges and per-practitioner figures. Hiding the
 * sidebar entry is courtesy; the refusal is here.
 *
 * One procedure per section, so each card loads and fails on its own. Every
 * money figure is selected through the SAME fragments as the dashboard,
 * `/paiements` and `/charges` (src/database/sql/*); no second definition of
 * revenue, production, charges, the billable rule or a balance exists here.
 *
 * The clinic's calendar is TypeScript's: the period and its buckets are
 * clinic-day instants built in `period.ts` / `buckets.ts`, sent to Postgres
 * as parameters. Sums and counts are Postgres's; JavaScript only places them
 * on the bucket list (zero-filling empty buckets) and subtracts the résultat
 * exactly as the dashboard does. No staff scoping (AGENTS.md §2).
 */

/** The period, its granularity and buckets — computed at each call. */
const resolve = (input: StatisticsInput) => {
  const period = resolvePeriod(input, new Date());
  const granularity = granularityFor(period);
  return { period, granularity, buckets: buildBuckets(period, granularity) };
};

/** The bucket fields a chart needs, without the instants. */
const pointOf = (bucket: ReturnType<typeof buildBuckets>[number]) => ({
  key: bucket.key,
  label: bucket.label,
  longLabel: bucket.longLabel,
});

/** The days a response describes — for the header's «Du … au …». */
const periodOf = ({ period, granularity }: ReturnType<typeof resolve>) => ({
  from: period.from,
  to: period.to,
  granularity,
});

// ── Shared fragments of this router ─────────────────────────────────────────

/**
 * «Produit»: billable actes (the shared rule) dated in the range by their
 * clinical date (the shared definition `/actes` lists by).
 */
const isProducedIn = (range: InstantRange) =>
  and(isBillableTreatment, treatmentDateInRange(range));

const productionCents = sql<number>`COALESCE(${sum(treatments.totalAmountCents)}, 0)::int`;

const startsIn = (range: InstantRange) =>
  inInstantRange(appointments.startsAt, range);

const isStatus = (status: AppointmentStatus) => eq(appointments.status, status);

/** Encaissé by one method, inside a grouped payments query. */
const methodCents = (method: PaymentMethod) =>
  sql<number>`(COALESCE(SUM(${payments.amountCents}) FILTER (WHERE ${payments.method} = ${method}), 0))::int`;

/** Every count the overview and the «Rendez-vous» chart read. */
const appointmentCountColumns = {
  completed: countWhere(isCompleted),
  noShow: countWhere(isStatus(AppointmentStatus.NoShow)),
  canceled: countWhere(isStatus(AppointmentStatus.Canceled)),
  total: sql<number>`COUNT(*)::int`,
  activePatients: sql<number>`(COUNT(DISTINCT ${appointments.patientId}) FILTER (WHERE ${isCompleted}))::int`,
};

const comparison = <T>(current: T, previous: T) => ({ current, previous });

// ── Router ──────────────────────────────────────────────────────────────────

export const statisticsRouter = createTRPCRouter({
  /**
   * The KPI row: every figure with the previous period's value. «Reste à
   * encaisser» and «Avances» are as of now (the shared balance SQL), not
   * bound to the period. Charges and résultat are null when the period has
   * no charge (the dashboard's rule).
   */
  getOverview: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { range, previous } = resolved.period;

      const [
        [revenue],
        [previousRevenue],
        [production],
        [previousProduction],
        [visits],
        [previousVisits],
        [newPatients],
        [previousNewPatients],
        [charges],
        [previousCharges],
        [balances],
      ] = await db.batch([
        db.select(revenueColumns).from(payments).where(paidInRange(range)),
        db
          .select(revenueColumns)
          .from(payments)
          .where(paidInRange(previous.range)),
        db
          .select({ productionCents })
          .from(treatments)
          .where(isProducedIn(range)),
        db
          .select({ productionCents })
          .from(treatments)
          .where(isProducedIn(previous.range)),
        db
          .select(appointmentCountColumns)
          .from(appointments)
          .where(startsIn(range)),
        db
          .select(appointmentCountColumns)
          .from(appointments)
          .where(startsIn(previous.range)),
        // `createdAt` has no zone and holds UTC; the column's own encoder
        // writes the bound in UTC, so the comparison is instant to instant.
        db
          .select({ n: count() })
          .from(patients)
          .where(inInstantRange(patients.createdAt, range)),
        db
          .select({ n: count() })
          .from(patients)
          .where(inInstantRange(patients.createdAt, previous.range)),
        db.select(chargesColumns).from(expenses).where(spentInRange(range)),
        db
          .select(chargesColumns)
          .from(expenses)
          .where(spentInRange(previous.range)),
        db.select(receivablesColumns(remainingCents)).from(patients),
      ]);

      const resultat = netProfitCents({
        revenueCents: revenue.revenueCents,
        chargesCents: charges.chargesCents,
        expenseCount: charges.expenseCount,
      });
      const previousResultat = netProfitCents({
        revenueCents: previousRevenue.revenueCents,
        chargesCents: previousCharges.chargesCents,
        expenseCount: previousCharges.expenseCount,
      });

      return {
        ...periodOf(resolved),
        previous: { from: previous.from, to: previous.to },
        encaisseCents: comparison(
          revenue.revenueCents,
          previousRevenue.revenueCents,
        ),
        paymentCount: revenue.paymentCount,
        productionCents: comparison(
          production.productionCents,
          previousProduction.productionCents,
        ),
        rendezVousHonores: comparison(
          visits.completed,
          previousVisits.completed,
        ),
        nouveauxPatients: comparison(newPatients.n, previousNewPatients.n),
        patientsActifs: comparison(
          visits.activePatients,
          previousVisits.activePatients,
        ),
        tauxAbsence: comparison(
          absenceRate(visits),
          absenceRate(previousVisits),
        ),
        tauxAnnulation: comparison(
          cancellationRate(visits),
          cancellationRate(previousVisits),
        ),
        resteAEncaisserCents: balances.outstandingCents,
        avancesCents: balances.advancesCents,
        // Decision 6: absent, not zero, without a charge in the period.
        chargesCents:
          resultat === null
            ? null
            : comparison(charges.chargesCents, previousCharges.chargesCents),
        // The previous period may have had no charge: its résultat is null.
        resultatCents:
          resultat === null
            ? null
            : { current: resultat, previous: previousResultat },
      };
    }),

  /** Per bucket: encaissé (and by method) and produit — two quantities. */
  getRevenueSeries: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { range } = resolved.period;
      const { buckets } = resolved;

      const [collected, produced] = await db.batch([
        db
          .select({
            idx: bucketIndex(payments.paidAt, buckets),
            encaisseCents: revenueColumns.revenueCents,
            cash: methodCents(PaymentMethod.Cash),
            check: methodCents(PaymentMethod.Check),
            card: methodCents(PaymentMethod.Card),
            transfer: methodCents(PaymentMethod.Transfer),
            insurance: methodCents(PaymentMethod.Insurance),
          })
          .from(payments)
          .where(paidInRange(range))
          .groupBy(sql`1`),
        db
          .select({
            idx: bucketIndex(treatmentDate, buckets),
            productionCents,
          })
          .from(treatments)
          .where(isProducedIn(range))
          .groupBy(sql`1`),
      ]);

      const collectedAt = byBucket(collected);
      const producedAt = byBucket(produced);

      return {
        ...periodOf(resolved),
        buckets,
        points: buckets.map((bucket, position) => {
          const row = collectedAt(position);
          return {
            ...pointOf(bucket),
            encaisseCents: row?.encaisseCents ?? 0,
            productionCents: producedAt(position)?.productionCents ?? 0,
            encaisseParMode: {
              [PaymentMethod.Cash]: row?.cash ?? 0,
              [PaymentMethod.Check]: row?.check ?? 0,
              [PaymentMethod.Card]: row?.card ?? 0,
              [PaymentMethod.Transfer]: row?.transfer ?? 0,
              [PaymentMethod.Insurance]: row?.insurance ?? 0,
            },
          };
        }),
      };
    }),

  /** Per bucket: the period's appointments by outcome. */
  getAppointmentsSeries: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { buckets } = resolved;

      const rows = await db
        .select({
          idx: bucketIndex(appointments.startsAt, buckets),
          completed: appointmentCountColumns.completed,
          canceled: appointmentCountColumns.canceled,
          noShow: appointmentCountColumns.noShow,
          upcoming: countWhere(
            inArray(appointments.status, [...UPCOMING_STATUSES]),
          ),
        })
        .from(appointments)
        .where(startsIn(resolved.period.range))
        .groupBy(sql`1`);

      const at = byBucket(rows);

      return {
        ...periodOf(resolved),
        buckets,
        points: buckets.map((bucket, position) => {
          const row = at(position);
          return {
            ...pointOf(bucket),
            completed: row?.completed ?? 0,
            canceled: row?.canceled ?? 0,
            noShow: row?.noShow ?? 0,
            upcoming: row?.upcoming ?? 0,
          };
        }),
      };
    }),

  /** The donut: encaissé per method, with the period's total (SQL's). */
  getPaymentMethodBreakdown: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { range } = resolved.period;

      const [rows, [total]] = await db.batch([
        db
          .select({ method: payments.method, ...revenueColumns })
          .from(payments)
          .where(paidInRange(range))
          .groupBy(payments.method),
        db.select(revenueColumns).from(payments).where(paidInRange(range)),
      ]);

      const byMethod = new Map(rows.map((row) => [row.method, row]));

      return {
        ...periodOf(resolved),
        totalCents: total.revenueCents,
        paymentCount: total.paymentCount,
        // Five methods = five slices: never more than MAX_SLICES.
        slices: PAYMENT_METHOD_SERIES.map((method) => ({
          method,
          amountCents: byMethod.get(method)?.revenueCents ?? 0,
          count: byMethod.get(method)?.paymentCount ?? 0,
        })),
      };
    }),

  /**
   * The 10 most frequent billable actes and the 10 most productive, grouped
   * by their label snapshot — the text the dossier and `/actes` show.
   */
  getTopActes: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const where = isProducedIn(resolved.period.range);
      const columns = {
        label: treatments.label,
        count: sql<number>`COUNT(*)::int`,
        productionCents,
      };

      const [byCount, byValue] = await db.batch([
        db
          .select(columns)
          .from(treatments)
          .where(where)
          .groupBy(treatments.label)
          .orderBy(sql`2 DESC`, sql`3 DESC`, sql`1`)
          .limit(TOP_ACTES_LIMIT),
        db
          .select(columns)
          .from(treatments)
          .where(where)
          .groupBy(treatments.label)
          .orderBy(sql`3 DESC`, sql`2 DESC`, sql`1`)
          .limit(TOP_ACTES_LIMIT),
      ]);

      return { ...periodOf(resolved), byCount, byValue };
    }),

  /**
   * Produit by the catalogue category of each acte's service. The schema has
   * a real category (`services.category`); an acte whose service was
   * removed counts as `other`. Folded to MAX_SLICES in SQL.
   */
  getActesByCategory: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);

      const grouped = db
        .select({
          key: sql<string>`COALESCE(${services.category}::text, 'other')`.as(
            "key",
          ),
          value: productionCents.as("value"),
          n: sql<number>`COUNT(*)::int`.as("n"),
        })
        .from(treatments)
        .leftJoin(services, eq(treatments.serviceId, services.id))
        .where(isProducedIn(resolved.period.range))
        .groupBy(sql`1`)
        .as("grouped");

      const [slices, [total]] = await db.batch([
        foldIntoOthers(grouped),
        db
          .select({ productionCents })
          .from(treatments)
          .where(isProducedIn(resolved.period.range)),
      ]);

      return {
        ...periodOf(resolved),
        totalCents: total.productionCents,
        slices: slices.map((slice) => ({
          key: slice.key,
          isOthers: slice.key === OTHERS_KEY,
          productionCents: slice.value,
          count: slice.n,
        })),
      };
    }),

  /**
   * «Fréquentation»: honoured appointments by clinic weekday and by
   * weekday × hour. The weekday and hour of every slot are read in
   * TypeScript (`buildHourSlots`, `buildDaySlots`); Postgres only counts
   * which precomputed slot each `startsAt` falls in.
   */
  getAppointmentsDistribution: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const where = and(isCompleted, startsIn(resolved.period.range));
      const hourSlots = buildHourSlots(resolved.period);
      const daySlots = buildDaySlots(resolved.period);

      const [cells, days] = await db.batch([
        db
          .select({
            cls: slotClassOf(
              appointments.startsAt,
              hourSlots,
              hourSlots.map((slot) => slotClass(slot.weekdayIndex, slot.hour)),
            ),
            count: sql<number>`COUNT(*)::int`,
          })
          .from(appointments)
          .where(where)
          .groupBy(sql`1`),
        db
          .select({
            weekdayIndex: slotClassOf(
              appointments.startsAt,
              daySlots,
              daySlots.map((slot) => slot.weekdayIndex),
            ),
            count: sql<number>`COUNT(*)::int`,
          })
          .from(appointments)
          .where(where)
          .groupBy(sql`1`),
      ]);

      const countByClass = new Map(cells.map((cell) => [cell.cls, cell.count]));
      const countByWeekday = new Map(
        days.map((day) => [day.weekdayIndex, day.count]),
      );

      return {
        ...periodOf(resolved),
        weekdays: Array.from({ length: 7 }, (_, weekdayIndex) => ({
          weekdayIndex,
          count: countByWeekday.get(weekdayIndex) ?? 0,
        })),
        cells: Array.from({ length: 7 * 24 }, (_, cls) => ({
          weekdayIndex: Math.floor(cls / 24),
          hour: cls % 24,
          count: countByClass.get(cls) ?? 0,
        })),
      };
    }),

  /**
   * Per practitioner: honoured appointments (`appointments.practitionerId`)
   * and production (`treatments.practitionerId` — actes record their
   * practitioner). Payments sit on the patient account, so no revenue is
   * attributed to a practitioner.
   */
  getByPractitioner: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { range } = resolved.period;

      const [visits, produced] = await db.batch([
        db
          .select({
            id: appointments.practitionerId,
            name: user.name,
            completed: sql<number>`COUNT(*)::int`,
          })
          .from(appointments)
          .leftJoin(user, eq(appointments.practitionerId, user.id))
          .where(and(isCompleted, startsIn(range)))
          .groupBy(appointments.practitionerId, user.name),
        db
          .select({
            id: treatments.practitionerId,
            name: user.name,
            productionCents,
          })
          .from(treatments)
          .leftJoin(user, eq(treatments.practitionerId, user.id))
          .where(isProducedIn(range))
          .groupBy(treatments.practitionerId, user.name),
      ]);

      const practitioners = new Map<
        string,
        {
          key: string;
          name: string | null;
          completed: number;
          productionCents: number;
        }
      >();
      const entry = (id: string | null, name: string | null) => {
        const key = id ?? NO_PRACTITIONER_KEY;
        const existing = practitioners.get(key);
        if (existing) return existing;
        const created = { key, name, completed: 0, productionCents: 0 };
        practitioners.set(key, created);
        return created;
      };
      // Merging two grouped results by id — no figure is added up here.
      for (const row of visits)
        entry(row.id, row.name).completed = row.completed;
      for (const row of produced) {
        entry(row.id, row.name).productionCents = row.productionCents;
      }

      return {
        ...periodOf(resolved),
        practitioners: [...practitioners.values()].sort(
          (a, b) =>
            b.productionCents - a.productionCents ||
            b.completed - a.completed ||
            a.key.localeCompare(b.key),
        ),
      };
    }),

  /**
   * Per bucket: encaissé, charges and résultat. `null` when the period has
   * no charge at all (decision 6): a résultat equal to the revenue would
   * claim «no costs» when the truth is «costs not entered».
   *
   * `spentAt` is a clinic DATE stored as that day's clinic-midnight instant
   * (prompts/26); the buckets start on clinic midnights drawn from clinic
   * date strings, so a charge dated on the first or last day of a month
   * lands in that month's bucket. The period filter is `/charges`' own
   * `spentInRange`.
   */
  getRevenueVsCharges: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const { range } = resolved.period;
      const { buckets } = resolved;

      const [[totals], collected, spent] = await db.batch([
        db.select(chargesColumns).from(expenses).where(spentInRange(range)),
        db
          .select({
            idx: bucketIndex(payments.paidAt, buckets),
            encaisseCents: revenueColumns.revenueCents,
          })
          .from(payments)
          .where(paidInRange(range))
          .groupBy(sql`1`),
        db
          .select({
            idx: bucketIndex(expenses.spentAt, buckets),
            chargesCents: chargesColumns.chargesCents,
          })
          .from(expenses)
          .where(spentInRange(range))
          .groupBy(sql`1`),
      ]);

      if (totals.expenseCount === 0) return null;

      const collectedAt = byBucket(collected);
      const spentAt = byBucket(spent);

      return {
        ...periodOf(resolved),
        buckets,
        chargesCents: totals.chargesCents,
        points: buckets.map((bucket, position) => {
          const encaisseCents = collectedAt(position)?.encaisseCents ?? 0;
          const chargesCents = spentAt(position)?.chargesCents ?? 0;
          return {
            ...pointOf(bucket),
            encaisseCents,
            chargesCents,
            // The dashboard's subtraction, per bucket. Never clamped.
            resultatCents: encaisseCents - chargesCents,
          };
        }),
      };
    }),

  /**
   * Patients (not archived) by their CURRENT insurer — a snapshot of
   * people, not money, and not bound to the period. Folded to MAX_SLICES.
   */
  getInsurerBreakdown: adminProcedure
    .input(statisticsInputSchema)
    .query(async ({ input }) => {
      const resolved = resolve(input);
      const isCurrent = eq(patients.isArchived, false);

      const grouped = db
        .select({
          key: sql<string>`COALESCE(${patients.insurerId}, ${NO_INSURER_KEY})`.as(
            "key",
          ),
          value: sql<number>`COUNT(*)::int`.as("value"),
          n: sql<number>`COUNT(*)::int`.as("n"),
        })
        .from(patients)
        .where(isCurrent)
        .groupBy(sql`1`)
        .as("grouped");

      const [slices, [total], names] = await db.batch([
        foldIntoOthers(grouped),
        db.select({ n: count() }).from(patients).where(isCurrent),
        db.select({ id: insurers.id, name: insurers.name }).from(insurers),
      ]);

      const nameOf = new Map(
        names.map((insurer) => [insurer.id, insurer.name]),
      );

      return {
        ...periodOf(resolved),
        totalPatients: total.n,
        slices: slices.map((slice) => ({
          key: slice.key,
          isOthers: slice.key === OTHERS_KEY,
          isUninsured: slice.key === NO_INSURER_KEY,
          name: nameOf.get(slice.key) ?? null,
          patients: slice.value,
        })),
      };
    }),
});
