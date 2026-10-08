"use client";

import { useMutation } from "@tanstack/react-query";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { useTRPC } from "@/trpc/client";
import { DOCUMENT_COPY as COPY, DOCUMENT_TYPE_LABELS } from "../constants";
import { useInvalidateDocuments } from "../hooks/use-invalidate-documents";
import type { DocumentListItem, DocumentType } from "../types";
import { documentPdfUrl } from "../urls";

interface DocumentActionsProps {
  document: DocumentListItem;
  /** The clinic-wide list links to the dossier; the dossier itself does not. */
  showDossierLink?: boolean;
}

/**
 * A row's menu: open (new tab, printed from the browser's PDF viewer),
 * download, the dossier link, and the admin's delete. The delete is cosmetic
 * here: `remove` is an `adminProcedure` (AGENTS.md §2).
 */
const DocumentActions = ({
  document,
  showDossierLink = false,
}: DocumentActionsProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const invalidate = useInvalidateDocuments();

  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  const label = DOCUMENT_TYPE_LABELS[document.type as DocumentType];
  const number = document.number ?? COPY.noNumber;

  // Says, before the admin decides, that the number is NOT reused.
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription(label, number),
    "destructive",
  );

  const removeDocument = useMutation(
    trpc.documents.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.removed);
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidate();
      },
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removeDocument.mutate({ id: document.id });
  };

  return (
    <>
      <RemoveConfirmation />
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={removeDocument.isPending}
                aria-label={COPY.actionsLabel}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() =>
                window.open(documentPdfUrl(document.id, "inline"), "_blank")
              }
            >
              <ExternalLinkIcon />
              {COPY.open}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.location.href = documentPdfUrl(document.id, "download");
              }}
            >
              <DownloadIcon />
              {COPY.download}
            </DropdownMenuItem>
            {showDossierLink && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/patients/${document.patientId}?tab=documents`)
                }
              >
                <FolderOpenIcon />
                {COPY.openDossier}
              </DropdownMenuItem>
            )}

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void handleRemove()}
                >
                  <Trash2Icon />
                  {COPY.remove}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default DocumentActions;
