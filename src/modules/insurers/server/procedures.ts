import "server-only";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ne,
  sql,
} from "drizzle-orm";

import { db } from "@/database";
import { insurers, patients } from "@/database/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { INSURER_SERVER_ERRORS } from "../constants";
import {
  insurerFormSchema,
  insurerIdSchema,
  insurerUpdateSchema,
} from "../schemas";

/**
 * Insurers are managed in Paramètres. There is no `remove`, ever: patients and
 * payments reference them, and a deactivated insurer must keep resolving on
 * every historical patient, list column and printed document.
 *
 * `getMany` returns every insurer with its `isActive` flag; each consumer
 * decides what to offer (`options.ts`).
 */

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: INSURER_SERVER_ERRORS.notFound });

/** «cnss» and «CNSS» are the same organisation. */
const assertNameAvailable = async (name: string, exceptId?: string) => {
  const [taken] = await db
    .select({ id: insurers.id })
    .from(insurers)
    .where(
      and(
        sql`lower(${insurers.name}) = lower(${name})`,
        exceptId ? ne(insurers.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: INSURER_SERVER_ERRORS.duplicateName,
    });
  }
};

const setActive = async (id: string, isActive: boolean) => {
  const [updated] = await db
    .update(insurers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(insurers.id, id))
    .returning();

  if (!updated) throw notFound();
  return updated;
};

export const insurersRouter = createTRPCRouter({
  // Active first, then by name. `patientCount` counts archived patients too:
  // they still carry the insurer.
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select({
        ...getTableColumns(insurers),
        patientCount: count(patients.id),
      })
      .from(insurers)
      .leftJoin(patients, eq(patients.insurerId, insurers.id))
      .groupBy(insurers.id)
      .orderBy(desc(insurers.isActive), asc(insurers.name), asc(insurers.id));

    return { items, total: items.length, totalPages: 1 };
  }),

  create: adminProcedure
    .input(insurerFormSchema)
    .mutation(async ({ input }) => {
      await assertNameAvailable(input.name);

      const [created] = await db.insert(insurers).values(input).returning();
      return created;
    }),

  update: adminProcedure
    .input(insurerUpdateSchema)
    .mutation(async ({ input }) => {
      const { id, ...values } = input;
      await assertNameAvailable(values.name, id);

      const [updated] = await db
        .update(insurers)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(insurers.id, id))
        .returning();

      if (!updated) throw notFound();
      return updated;
    }),

  /** Reversible: hidden from new selections, still resolved everywhere else. */
  deactivate: adminProcedure
    .input(insurerIdSchema)
    .mutation(({ input }) => setActive(input.id, false)),

  reactivate: adminProcedure
    .input(insurerIdSchema)
    .mutation(({ input }) => setActive(input.id, true)),
});
