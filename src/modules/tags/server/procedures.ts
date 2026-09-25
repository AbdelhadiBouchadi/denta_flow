import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/database";
import { tags } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Read-only on this branch. Tags are created and renamed in Paramètres, which
 * does not exist yet; the patients list filter and the patient form are the
 * only consumers, and both need the whole table.
 */
export const tagsRouter = createTRPCRouter({
  // The envelope, not a bare array (05-slice.md §5 rule 3). A configuration
  // table is small enough that the page is always the whole table, so `total`
  // is the row count and there is exactly one page.
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select()
      .from(tags)
      .orderBy(asc(tags.label), asc(tags.id));

    return { items, total: items.length, totalPages: 1 };
  }),
});
