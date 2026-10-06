import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, getTableColumns, ne, sql } from "drizzle-orm";

import { db } from "@/database";
import { patientTags, tags } from "@/database/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TAG_SERVER_ERRORS } from "../constants";
import { tagFormSchema, tagIdSchema, tagUpdateSchema } from "../schemas";

/**
 * Tags are configured in Paramètres; the patients list filter and the patient
 * form read the same `getMany`. A clinic has a handful, so no pagination.
 *
 * Every write is an `adminProcedure`, and `remove` is a hard delete whose
 * `patient_tags` rows cascade in the database (01-database.md).
 */

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: TAG_SERVER_ERRORS.notFound });

/**
 * Case-insensitive uniqueness, checked here: «urgent» and «Urgent» side by side
 * in a filter would be two tags nobody can tell apart.
 */
const assertLabelAvailable = async (label: string, exceptId?: string) => {
  const [taken] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(
        sql`lower(${tags.label}) = lower(${label})`,
        exceptId ? ne(tags.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: TAG_SERVER_ERRORS.duplicateLabel,
    });
  }
};

export const tagsRouter = createTRPCRouter({
  // The envelope, not a bare array (05-slice.md §5 rule 3). `patientCount`
  // is an addition: the existing consumers read only the tag columns.
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select({
        ...getTableColumns(tags),
        patientCount: count(patientTags.patientId),
      })
      .from(tags)
      .leftJoin(patientTags, eq(patientTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(asc(tags.label), asc(tags.id));

    return { items, total: items.length, totalPages: 1 };
  }),

  create: adminProcedure.input(tagFormSchema).mutation(async ({ input }) => {
    await assertLabelAvailable(input.label);

    const [created] = await db.insert(tags).values(input).returning();
    return created;
  }),

  update: adminProcedure.input(tagUpdateSchema).mutation(async ({ input }) => {
    // `id` is destructured out: it must never reach .set().
    const { id, ...values } = input;
    await assertLabelAvailable(values.label, id);

    const [updated] = await db
      .update(tags)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning();

    if (!updated) throw notFound();
    return updated;
  }),

  remove: adminProcedure.input(tagIdSchema).mutation(async ({ input }) => {
    const [removed] = await db
      .delete(tags)
      .where(eq(tags.id, input.id))
      .returning();

    if (!removed) throw notFound();
    return removed;
  }),
});
