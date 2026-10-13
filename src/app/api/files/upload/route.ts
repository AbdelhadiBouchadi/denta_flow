import type { HandleUploadBody } from "@vercel/blob/client";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  handlePrivateUpload,
  isPrivateStorageConfigured,
  PRIVATE_STORAGE_NOT_CONFIGURED,
} from "@/lib/storage/private";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  IMAGING_SERVER_ERRORS as E,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_MAX_BYTES,
  UPLOAD_TOKEN_TTL_MS,
} from "@/modules/imaging/constants";
import { isPatientFilePathname } from "@/modules/imaging/files";
import { imagingReadDenial, imagingWriteDenial } from "@/modules/imaging/rules";
import { uploadClientPayloadSchema } from "@/modules/imaging/schemas";
import { readPatientForUpload } from "@/modules/imaging/server/procedures";

/**
 * POST /api/files/upload — signs a client-upload token for ONE pathname in
 * the PRIVATE store (prompts/31, decision 4). The browser then sends the
 * bytes straight to the store; this server never receives them. The upload
 * is recorded afterwards by `imaging.register`, which checks the blob with
 * `head()` — `onUploadCompleted` is not used (it never fires on localhost).
 *
 * Authorization is checked HERE: proxy.ts does not match /api and is never a
 * security control. Every refusal is decided before a token exists.
 */

export const runtime = "nodejs";

class UploadRejection extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const reject = (status: number, message: string) =>
  Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });
  if (!session.user.isActive) return new Response(null, { status: 403 });

  const roleDenial = imagingReadDenial(session.user.role);
  if (roleDenial) return reject(403, roleDenial);

  if (!isPrivateStorageConfigured()) {
    return reject(503, PRIVATE_STORAGE_NOT_CONFIGURED);
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return reject(400, E.invalidRequest);
  }
  // No completion callback is ever requested, so the only event this route
  // serves is the token request.
  if (body?.type !== "blob.generate-client-token") {
    return reject(400, E.invalidRequest);
  }

  try {
    const result = await handlePrivateUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: unknown;
        try {
          payload = JSON.parse(clientPayload ?? "");
        } catch {
          throw new UploadRejection(400, E.invalidRequest);
        }
        const parsed = uploadClientPayloadSchema.safeParse(payload);
        if (!parsed.success) throw new UploadRejection(400, E.invalidRequest);
        const { patientId, isThumbnail } = parsed.data;

        const patient = await readPatientForUpload(patientId);
        if (!patient) throw new UploadRejection(404, E.patientNotFound);
        const denial = imagingWriteDenial({
          role: session.user.role,
          patientIsArchived: patient.isArchived,
        });
        if (denial) throw new UploadRejection(403, denial);

        if (
          !isPatientFilePathname(pathname, patientId, { thumbnail: isThumbnail })
        ) {
          throw new UploadRejection(400, E.pathnameForeign);
        }

        return {
          allowedContentTypes: isThumbnail
            ? [THUMBNAIL_CONTENT_TYPE]
            : [...IMAGE_CONTENT_TYPES],
          maximumSizeInBytes: isThumbnail ? THUMBNAIL_MAX_BYTES : IMAGE_MAX_BYTES,
          // The store appends its own random suffix: the stored name is
          // unpredictable whatever the browser asked for, and nothing is
          // ever overwritten.
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + UPLOAD_TOKEN_TTL_MS,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof UploadRejection) {
      return reject(error.status, error.message);
    }
    // Ids only — never a patient name or a pathname in the server log.
    console.error("[api/files/upload] token generation failed:", error);
    return reject(500, E.uploadFailed);
  }
}
