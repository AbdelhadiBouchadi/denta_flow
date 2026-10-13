import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  getPrivateBlob,
  isPrivateStorageConfigured,
  PRIVATE_STORAGE_NOT_CONFIGURED,
} from "@/lib/storage/private";
import { buildImageFileName } from "@/modules/imaging/files";
import { imagingReadDenial } from "@/modules/imaging/rules";
import { readFileForDelivery } from "@/modules/imaging/server/procedures";
import type { PatientFileKind } from "@/modules/imaging/types";

/**
 * GET /api/files/[id] — a patient image, streamed from the PRIVATE store
 * (prompts/31, decisions 2, 7 and 9). Same-origin, so the session cookie
 * rides on every `<img>` request and is checked on every one; the blob URL
 * never leaves this server.
 *
 * - `?thumb=1`    the browser-made thumbnail (404 when there is none)
 * - `?download=1` the original as an attachment, with a safe filename
 *
 * Authorization is checked HERE — proxy.ts does not match /api.
 */

// The SDK's stream and the session read need Node; never the edge runtime.
export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  // Medical data: never stored by any cache, shared or not.
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const empty = (status: number) =>
  new Response(null, { status, headers: PRIVATE_HEADERS });

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/files/[id]">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return empty(401);
  if (!session.user.isActive) return empty(403);
  if (imagingReadDenial(session.user.role)) return empty(403);

  const { id } = await params;
  const file = await readFileForDelivery(id);
  if (!file) return empty(404);

  if (!isPrivateStorageConfigured()) {
    return new Response(PRIVATE_STORAGE_NOT_CONFIGURED, {
      status: 503,
      headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const search = request.nextUrl.searchParams;
  const wantsThumb = search.get("thumb") === "1";
  const pathname = wantsThumb ? file.thumbPathname : file.blobPathname;
  if (!pathname) return empty(404);

  const blob = await getPrivateBlob(pathname);
  if (!blob) return empty(404);

  const responseHeaders = new Headers(PRIVATE_HEADERS);
  // The type recorded at register time — the store's own answer to `head()`
  // — never a type guessed from the bytes.
  responseHeaders.set(
    "Content-Type",
    wantsThumb ? blob.blob.contentType : file.contentType,
  );
  responseHeaders.set("Content-Length", String(blob.blob.size));

  if (!wantsThumb && search.get("download") === "1") {
    // ASCII-only by construction (files.ts), so safe in the header as is.
    const fileName = buildImageFileName({
      kind: file.kind as PatientFileKind,
      firstName: file.firstName,
      lastName: file.lastName,
      takenAt: file.takenAt,
      contentType: file.contentType,
    });
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );
  }

  return new Response(blob.stream, { status: 200, headers: responseHeaders });
}
