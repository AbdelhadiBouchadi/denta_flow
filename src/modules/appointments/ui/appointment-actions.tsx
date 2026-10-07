"use client";

import { useMutation } from "@tanstack/react-query";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import {
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_ACTION_LABELS,
  APPOINTMENT_STATUS_TOASTS,
} from "../constants";
import { useInvalidateAppointments } from "../hooks/use-invalidate-appointments";
import { nextStatuses } from "../status";
import { AppointmentStatus, type AppointmentListItem } from "../types";
import UpdateAppointmentDialog from "./update-appointment-dialog";

interface AppointmentActionsProps {
  appointment: AppointmentListItem;
}

/**
 * A row's menu: edit, the status moves legal from here, and the admin's hard
 * delete. The menu reads the transition table only to decide what to offer —
 * `updateStatus` enforces it whatever is clicked.
 */
const AppointmentActions = ({ appointment }: AppointmentActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointments();
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Cosmetic only: `appointments.remove` is an adminProcedure and refuses a
  // non-admin whatever this menu shows (AGENTS.md §2).
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    APPOINTMENT_COPY.removeTitle,
    APPOINTMENT_COPY.removeDescription,
    "destructive",
  );

  // Both moves are terminal — there is no way back — so each is confirmed.
  const [CancelConfirmation, confirmCancel] = useConfirm(
    APPOINTMENT_COPY.cancelTitle,
    APPOINTMENT_COPY.cancelDescription,
    "destructive",
  );
  const [NoShowConfirmation, confirmNoShow] = useConfirm(
    APPOINTMENT_COPY.noShowTitle,
    APPOINTMENT_COPY.noShowDescription,
    "destructive",
  );

  const updateStatus = useMutation(
    trpc.appointments.updateStatus.mutationOptions({
      onSuccess: async (updated) => {
        await invalidateAll();
        toast.success(
          APPOINTMENT_STATUS_TOASTS[updated.status as AppointmentStatus],
        );
      },
      onError: async (error) => {
        // A CONFLICT here means someone else moved it first: show the
        // fresh status rather than leave the stale menu in place.
        if (error.data?.code === "CONFLICT") await invalidateAll();
        toast.error(getErrorMessage(error));
      },
    }),
  );

  const removeAppointment = useMutation(
    trpc.appointments.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_COPY.removed);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = updateStatus.isPending || removeAppointment.isPending;
  const moves = nextStatuses(appointment.status as AppointmentStatus);

  const handleMove = async (status: AppointmentStatus) => {
    if (status === AppointmentStatus.Canceled && !(await confirmCancel())) {
      return;
    }
    if (status === AppointmentStatus.NoShow && !(await confirmNoShow())) {
      return;
    }
    updateStatus.mutate({ id: appointment.id, status });
  };

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removeAppointment.mutate({ id: appointment.id });
  };

  return (
    <>
      <CancelConfirmation />
      <NoShowConfirmation />
      <RemoveConfirmation />
      <UpdateAppointmentDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={appointment}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={isPending}
                aria-label={APPOINTMENT_COPY.actionsLabel}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {APPOINTMENT_COPY.edit}
            </DropdownMenuItem>

            {moves.length > 0 && <DropdownMenuSeparator />}
            {moves.map((status) => (
              <DropdownMenuItem
                key={status}
                variant={
                  status === AppointmentStatus.Canceled ||
                  status === AppointmentStatus.NoShow
                    ? "destructive"
                    : "default"
                }
                onClick={() => void handleMove(status)}
              >
                {APPOINTMENT_STATUS_ACTION_LABELS[status]}
              </DropdownMenuItem>
            ))}

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void handleRemove()}
                >
                  <Trash2Icon />
                  {APPOINTMENT_COPY.remove}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default AppointmentActions;
