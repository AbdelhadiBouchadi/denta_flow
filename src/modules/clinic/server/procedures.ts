import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ASSET_MAX_BYTES } from "@/constants";
import { db } from "@/database";
import { clinicSettings } from "@/database/schema";
import {
  ASSET_SNIFF_BYTES,
  detectImageType,
  isAcceptedMimeType,
  isClinicBlobUrl,
} from "@/lib/assets";
import { deleteAsset, uploadAsset } from "@/lib/blob";
import { env } from "@/lib/env";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { CLINIC_ASSET_ERRORS, CLINIC_SERVER_ERRORS } from "../constants";
import {
  clinicAssetUploadSchema,
  clinicSettingsUpdateSchema,
} from "../schemas";

/** The table holds exactly one row (01-database.md). */
const CLINIC_ROW_ID = "clinic";

const byClinicRow = eq(clinicSettings.id, CLINIC_ROW_ID);

/**
 * The stored URL an `update` makes stale: the old one when the input replaces
 * or removes it (`string` / `null`), nothing when the input leaves it alone
 * (`undefined`) or re-sends the same URL.
 */
const staleAsset = (
  previous: string | null | undefined,
  next: string | null | undefined,
) =>
  next !== undefined &&
  previous &&
  previous !== next &&
  isClinicBlobUrl(previous)
    ? previous
    : null;

/**
 * Bytes travel through tRPC (FormData, routed by the client's `splitLink` to a
 * non-batch `httpLink`) so an upload passes the same `adminProcedure` gate as
 * every other clinic write. Nothing is persisted here: the returned URL is
 * written by `clinic.update`, and the old blob is deleted there.
 *
 * Neither the file's contents nor its name are ever logged.
 */
export const clinicRouter = createTRPCRouter({
  /**
   * Every staff member reads the clinic's identity: the sidebar brand and
   * every printed document come from this row. Insert-if-missing first, so a
   * fresh deployment never needs a seed to render its own name.
   */
  get: protectedProcedure.query(async () => {
    const [, rows] = await db.batch([
      db
        .insert(clinicSettings)
        .values({
          id: CLINIC_ROW_ID,
          // Defaulted in env.ts, so a deployment that never set it still boots.
          name: env.NEXT_PUBLIC_CLINIC_NAME,
        })
        .onConflictDoNothing({ target: clinicSettings.id }),
      db.select().from(clinicSettings).where(byClinicRow).limit(1),
    ]);

    const [clinic] = rows;
    if (!clinic) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: CLINIC_SERVER_ERRORS.notFound,
      });
    }
    return clinic;
  }),

  /**
   * Admin only — the clinic's legal identity is printed on every invoice.
   *
   * Assets are tri-state (`clinicSettingsUpdateSchema`). The old blob is
   * deleted only once the new row is written: deleting first and then failing
   * the write would leave the row pointing at a file that no longer exists.
   * Deletion is best-effort — an orphan blob costs storage, a failed save
   * because of one costs the user their edits.
   */
  update: adminProcedure
    .input(clinicSettingsUpdateSchema)
    .mutation(async ({ input }) => {
      const { logoUrl, letterheadUrl, ...fields } = input;

      const [previous] = await db
        .select({
          logoUrl: clinicSettings.logoUrl,
          letterheadUrl: clinicSettings.letterheadUrl,
        })
        .from(clinicSettings)
        .where(byClinicRow)
        .limit(1);

      const values = {
        ...fields,
        ...(logoUrl !== undefined && { logoUrl }),
        ...(letterheadUrl !== undefined && { letterheadUrl }),
        updatedAt: new Date(),
      };

      // An upsert, so an update that races the very first `get` still lands.
      const [saved] = await db
        .insert(clinicSettings)
        .values({ id: CLINIC_ROW_ID, ...values })
        .onConflictDoUpdate({ target: clinicSettings.id, set: values })
        .returning();

      const stale = [
        staleAsset(previous?.logoUrl, logoUrl),
        staleAsset(previous?.letterheadUrl, letterheadUrl),
      ].filter((url): url is string => url !== null);

      const results = await Promise.allSettled(stale.map(deleteAsset));
      // Logged for the operator, never surfaced: the save itself succeeded.
      for (const result of results) {
        if (result.status === "rejected") {
          console.error(
            "[clinic.update] stale blob deletion failed:",
            result.reason instanceof Error
              ? result.reason.message
              : "unknown error",
          );
        }
      }

      return saved;
    }),

  uploadAsset: adminProcedure
    .input(z.instanceof(FormData))
    .mutation(async ({ input }) => {
      const parsed = clinicAssetUploadSchema.safeParse({
        kind: input.get("kind"),
        file: input.get("file"),
      });
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            parsed.error.issues[0]?.message ?? CLINIC_ASSET_ERRORS.missingFile,
        });
      }
      const { kind, file } = parsed.data;

      // 1. Declared size and type — cheap, before reading any bytes.
      if (file.size > ASSET_MAX_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: CLINIC_ASSET_ERRORS.tooLarge,
        });
      }
      if (!isAcceptedMimeType(file.type)) {
        throw new TRPCError({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: CLINIC_ASSET_ERRORS.unsupportedType,
        });
      }

      // 2. The client-declared type is not trusted: sniff the real one.
      const head = new Uint8Array(
        await file.slice(0, ASSET_SNIFF_BYTES).arrayBuffer(),
      );
      const sniffedType = detectImageType(head);
      if (sniffedType === null || sniffedType !== file.type) {
        throw new TRPCError({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: CLINIC_ASSET_ERRORS.contentMismatch,
        });
      }

      // 3. Store it under the sniffed type. The SDK's message never reaches
      // the user: it is English and may describe the store. It is logged for
      // the operator — it names the blob path (the kind), never the file.
      try {
        const url = await uploadAsset(kind, file, sniffedType);
        return { url };
      } catch (cause) {
        console.error(
          "[clinic.uploadAsset] blob upload failed:",
          cause instanceof Error ? cause.message : "unknown error",
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: CLINIC_ASSET_ERRORS.uploadFailed,
          cause,
        });
      }
    }),
});
