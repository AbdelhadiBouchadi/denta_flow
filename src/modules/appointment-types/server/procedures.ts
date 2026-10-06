import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/database";
import { appointmentTypes } from "@/database/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { APPOINTMENT_TYPE_SERVER_ERRORS } from "../constants";
import {
  appointmentTypeFormSchema,
  appointmentTypeIdSchema,
  appointmentTypeUpdateSchema,
} from "../schemas";

/**
 * Calendar presentation — a colour and a default duration. Separate from the
 * acte catalogue, which is billing; the two are never merged.
 *
 * There is no `remove`, ever: `appointments.typeId` references these rows. A
 * deactivated type is hidden from new bookings only and still resolves on old
 * ones. A clinic has a handful of types, so no pagination.
 */

const notFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: APPOINTMENT_TYPE_SERVER_ERRORS.notFound,
  });

/**
 * Case-insensitive uniqueness, checked here as tags and services do: two
 * «Contrôle» in the booking picker are two types nobody can tell apart.
 */
const assertLabelAvailable = async (label: string, exceptId?: string) => {
  const [taken] = await db
    .select({ id: appointmentTypes.id })
    .from(appointmentTypes)
    .where(
      and(
        sql`lower(${appointmentTypes.label}) = lower(${label})`,
        exceptId ? ne(appointmentTypes.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: APPOINTMENT_TYPE_SERVER_ERRORS.duplicateLabel,
    });
  }
};

const setActive = async (id: string, isActive: boolean) => {
  const [updated] = await db
    .update(appointmentTypes)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(appointmentTypes.id, id))
    .returning();

  if (!updated) throw notFound();
  return updated;
};

export const appointmentTypesRouter = createTRPCRouter({
  // Every type, inactive included: old appointments still resolve theirs.
  // Active first, then by label. The envelope, not a bare array.
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select()
      .from(appointmentTypes)
      .orderBy(
        desc(appointmentTypes.isActive),
        asc(appointmentTypes.label),
        asc(appointmentTypes.id),
      );

    return { items, total: items.length, totalPages: 1 };
  }),

  create: adminProcedure
    .input(appointmentTypeFormSchema)
    .mutation(async ({ input }) => {
      await assertLabelAvailable(input.label);

      const [created] = await db
        .insert(appointmentTypes)
        .values(input)
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(appointmentTypeUpdateSchema)
    .mutation(async ({ input }) => {
      // `id` is destructured out: it must never reach .set().
      const { id, ...values } = input;
      await assertLabelAvailable(values.label, id);

      const [updated] = await db
        .update(appointmentTypes)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(appointmentTypes.id, id))
        .returning();

      if (!updated) throw notFound();
      return updated;
    }),

  /** Reversible: hidden from new bookings, still resolved on old ones. */
  deactivate: adminProcedure
    .input(appointmentTypeIdSchema)
    .mutation(({ input }) => setActive(input.id, false)),

  reactivate: adminProcedure
    .input(appointmentTypeIdSchema)
    .mutation(({ input }) => setActive(input.id, true)),
});
