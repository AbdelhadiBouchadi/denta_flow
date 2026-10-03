import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ASSET_MAX_BYTES } from "@/constants";
import {
  ASSET_SNIFF_BYTES,
  detectImageType,
  isAcceptedMimeType,
} from "@/lib/assets";
import { uploadAsset } from "@/lib/blob";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { CLINIC_ASSET_ERRORS } from "../constants";
import { clinicAssetUploadSchema } from "../schemas";

/**
 * Upload only on this branch; branch 11 adds `getOne` and `update`.
 *
 * Bytes travel through tRPC (FormData, routed by the client's `splitLink` to a
 * non-batch `httpLink`) so an upload passes the same `adminProcedure` gate as
 * every other clinic write. Nothing is persisted here: the returned URL is
 * written by `clinic.update`, and the old blob is deleted there.
 *
 * Neither the file's contents nor its name are ever logged.
 */
export const clinicRouter = createTRPCRouter({
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
