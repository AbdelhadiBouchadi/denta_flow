import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/database";
import { certificateTemplates } from "@/database/schema";
import { logActivity } from "@/modules/activity/server/log";
import { CERTIFICATE_TEMPLATE_SUMMARIES } from "@/modules/activity/summaries";
import { ActivityAction, ActivityEntityType } from "@/modules/activity/types";
import { medicalWriterProcedure } from "@/modules/documents/server/medical-procedure";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { CERTIFICATE_TEMPLATE_SERVER_ERRORS as E } from "../constants";
import { certificateTemplateUpdateSchema } from "../schemas";

/**
 * The certificate templates (prompts/29). Three, seeded; V1 has no create and
 * no delete. Reading is any staff (the settings page prefetches it for
 * everyone, like the other catalogues); editing is admin or dentist.
 *
 * An issued certificat stores its final text: editing a template never
 * changes one.
 */

const columns = {
  id: certificateTemplates.id,
  key: certificateTemplates.key,
  title: certificateTemplates.title,
  body: certificateTemplates.body,
  isActive: certificateTemplates.isActive,
  position: certificateTemplates.position,
  updatedAt: certificateTemplates.updatedAt,
};

/** Millisecond-truncated, as for medications and the odontogram. */
const versionMatches = (expectedUpdatedAt: Date) =>
  sql`date_trunc('milliseconds', ${certificateTemplates.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`;

export const certificateTemplatesRouter = createTRPCRouter({
  /** In their seeded order. Three rows: no pagination to speak of. */
  getMany: protectedProcedure.query(() =>
    db
      .select(columns)
      .from(certificateTemplates)
      .orderBy(asc(certificateTemplates.position), asc(certificateTemplates.id)),
  ),

  update: medicalWriterProcedure
    .input(certificateTemplateUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, expectedUpdatedAt, ...values } = input;
      const guard = and(
        eq(certificateTemplates.id, id),
        versionMatches(expectedUpdatedAt),
      );

      const [, [updated]] = await db.batch([
        logActivity(
          {
            entityType: ActivityEntityType.CertificateTemplate,
            entityId: id,
            action: ActivityAction.Updated,
            patientId: null,
            summary: CERTIFICATE_TEMPLATE_SUMMARIES.updated(values.title),
            staffId: ctx.auth.user.id,
          },
          { table: certificateTemplates, where: guard },
        ),
        db
          .update(certificateTemplates)
          .set({ ...values, updatedAt: new Date() })
          .where(guard)
          .returning(columns),
      ]);
      if (updated) return updated;

      const [exists] = await db
        .select({ id: certificateTemplates.id })
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, id))
        .limit(1);
      throw new TRPCError(
        exists
          ? { code: "CONFLICT", message: E.changedMeanwhile }
          : { code: "NOT_FOUND", message: E.notFound },
      );
    }),
});
