"use client";

import { useMutation } from "@tanstack/react-query";
import {
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { TREATMENT_COPY as COPY } from "../constants";
import { useInvalidateTreatments } from "../hooks/use-invalidate-treatments";
import type { TreatmentListItem } from "../types";
import UpdateTreatmentDialog from "./update-treatment-dialog";

interface TreatmentActionsProps {
  treatment: TreatmentListItem;
  /** The clinic-wide list links to the dossier; the dossier itself does not. */
  showDossierLink?: boolean;
}

/** A row's menu: edit, open the dossier, and the admin's hard delete. */
const TreatmentActions = ({
  treatment,
  showDossierLink = false,
}: TreatmentActionsProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const invalidateAll = useInvalidateTreatments();
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Cosmetic only: `treatments.remove` is an adminProcedure and refuses a
  // non-admin whatever this menu shows (AGENTS.md §2).
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription,
    "destructive",
  );

  const removeTreatment = useMutation(
    trpc.treatments.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(COPY.removed);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removeTreatment.mutate({ id: treatment.id });
  };

  return (
    <>
      <RemoveConfirmation />
      {/* Mounted while open only: each opening is a fresh form on the row's
          current version. */}
      {isEditOpen && (
        <UpdateTreatmentDialog
          open
          onOpenChange={setIsEditOpen}
          initialValues={treatment}
        />
      )}

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={removeTreatment.isPending}
                aria-label={COPY.actionsLabel}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {COPY.edit}
            </DropdownMenuItem>
            {showDossierLink && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/patients/${treatment.patientId}?tab=treatments`)
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

export default TreatmentActions;
