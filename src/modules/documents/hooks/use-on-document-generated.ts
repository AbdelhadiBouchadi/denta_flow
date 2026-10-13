"use client";

import { toast } from "sonner";

import { DOCUMENT_COPY as COPY } from "../constants";
import { documentPdfUrl } from "../urls";
import { useInvalidateDocuments } from "./use-invalidate-documents";

/**
 * What every generator does once the server answered `{ id }`: open the PDF
 * in a new tab (the browser's viewer prints it), refresh the lists through
 * the slice's one invalidation block, and say so — or say that a popup
 * blocker refused the tab. Shared by the facture, devis, ordonnance and
 * certificat dialogs.
 */
export const useOnDocumentGenerated = (onDone: () => void) => {
  const invalidate = useInvalidateDocuments();
  return async ({ id }: { id: string }) => {
    const tab = window.open(documentPdfUrl(id, "inline"), "_blank");
    await invalidate();
    if (tab) toast.success(COPY.generated);
    else toast.info(COPY.popupBlocked);
    onDone();
  };
};
