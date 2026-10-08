import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { readDocumentForDownload } from "@/modules/documents/server/procedures";
import { renderDocumentPdf } from "@/modules/documents/server/render";

/**
 * GET /api/documents/[id] — the PDF of a generated document, rendered from
 * its stored snapshot on every request (prompts/21, decision 7). Not a tRPC
 * procedure: the browser opens it in a tab, prints it from its PDF viewer, or
 * downloads it with `?download=1`.
 *
 * Authorization is checked HERE — proxy.ts does not match /api and is never
 * a security control. Any active staff member may download (decision 10).
 */

// react-pdf and the font files need Node; never the edge runtime.
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/documents/[id]">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });
  if (!session.user.isActive) return new Response(null, { status: 403 });

  const { id } = await params;
  const document = await readDocumentForDownload(id);
  if (!document) return new Response(null, { status: 404 });

  const pdf = await renderDocumentPdf(document.snapshot);
  const disposition =
    request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  // `fileName` is ASCII-only by construction (file-name.ts), so it is safe
  // in the header as is.
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${document.fileName}"`,
      "Content-Length": String(pdf.byteLength),
      // Medical data: never stored by a shared cache.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
