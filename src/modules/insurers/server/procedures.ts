import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/database";
import { insurers } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Read-only on this branch. Insurers are managed in Paramètres, which does not
 * exist yet.
 *
 * Deactivated insurers are returned too, with their `isActive` flag: a patient
 * created years ago may still point at one, and dropping it from the payload
 * would silently blank the insurer field the first time that dossier is edited.
 */
export const insurersRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select()
      .from(insurers)
      .orderBy(asc(insurers.name), asc(insurers.id));

    return { items, total: items.length, totalPages: 1 };
  }),
});
