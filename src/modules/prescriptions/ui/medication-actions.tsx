"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CircleCheckIcon,
  CircleOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
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
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { PRESCRIPTION_COPY as COPY } from "../constants";
import { useInvalidatePrescriptions } from "../hooks/use-invalidate-prescriptions";
import { formatMedicationLabel } from "../normalize";
import type { MedicationListItem } from "../types";
import MedicationDialog from "./medication-dialog";

/**
 * A row's menu, for admins and dentists only — a courtesy: every procedure
 * behind it is a `medicalWriterProcedure`. Deactivating is a plain,
 * reversible toggle with a toast; there is no delete.
 */
const MedicationActions = ({ medication }: { medication: MedicationListItem }) => {
  const trpc = useTRPC();
  const invalidate = useInvalidatePrescriptions();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const setActive = useMutation(
    trpc.medications.setActive.mutationOptions({
      onSuccess: async (updated) => {
        await invalidate();
        toast.success(updated.isActive ? COPY.reactivated : COPY.deactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <>
      {/* Mounted while open only: each opening reads the row as it is now. */}
      {isEditOpen && (
        <MedicationDialog
          open
          onOpenChange={setIsEditOpen}
          initialValues={medication}
        />
      )}

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={setActive.isPending}
                aria-label={`${COPY.actionsLabel} ${formatMedicationLabel(medication)}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setActive.mutate({
                  id: medication.id,
                  isActive: !medication.isActive,
                })
              }
            >
              {medication.isActive ? <CircleOffIcon /> : <CircleCheckIcon />}
              {medication.isActive ? COPY.deactivate : COPY.reactivate}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default MedicationActions;
