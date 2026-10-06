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
import { APPOINTMENT_TYPE_COPY } from "../constants";
import { useInvalidateAppointmentTypes } from "../hooks/use-invalidate-appointment-types";
import type { AppointmentTypeListItem } from "../types";
import UpdateAppointmentTypeDialog from "./update-appointment-type-dialog";

interface AppointmentTypeActionsProps {
  type: AppointmentTypeListItem;
}

/**
 * A row's menu, rendered for admins only — a courtesy: every procedure behind
 * it is an `adminProcedure`.
 *
 * Deactivate and reactivate are a plain toggle with a toast, no confirmation:
 * nothing is lost, and the other one undoes it. There is no delete —
 * appointments reference their type.
 */
const AppointmentTypeActions = ({ type }: AppointmentTypeActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointmentTypes();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const deactivate = useMutation(
    trpc.appointmentTypes.deactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_TYPE_COPY.deactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const reactivate = useMutation(
    trpc.appointmentTypes.reactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_TYPE_COPY.reactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = deactivate.isPending || reactivate.isPending;

  return (
    <>
      <UpdateAppointmentTypeDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={type}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={isPending}
                aria-label={`${APPOINTMENT_TYPE_COPY.actionsLabel} ${type.label}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {APPOINTMENT_TYPE_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {type.isActive ? (
              <DropdownMenuItem
                onClick={() => deactivate.mutate({ id: type.id })}
              >
                <CircleOffIcon />
                {APPOINTMENT_TYPE_COPY.deactivate}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => reactivate.mutate({ id: type.id })}
              >
                <CircleCheckIcon />
                {APPOINTMENT_TYPE_COPY.reactivate}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default AppointmentTypeActions;
