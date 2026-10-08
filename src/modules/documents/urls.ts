/**
 * Where a document's PDF is served — GET /api/documents/[id]
 * (src/app/api/documents/[id]/route.ts). `inline` opens in the browser's PDF
 * viewer, from which it prints; `download` asks for an attachment.
 */
export const documentPdfUrl = (id: string, mode: "inline" | "download") =>
  mode === "download"
    ? `/api/documents/${encodeURIComponent(id)}?download=1`
    : `/api/documents/${encodeURIComponent(id)}`;
