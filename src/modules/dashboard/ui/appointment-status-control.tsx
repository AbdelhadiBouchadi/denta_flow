"use client";

import { useMutation } from "@tanstack/react-query";
import { ArmchairIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import {
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_ACTION_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  APPOINTMENT_STATUS_TOASTS,
} from "@/modules/appointments/constants";
import { useInvalidateAppointments } from "@/modules/appointments/hooks/use-invalidate-appointments";
import { nextStatuses } from "@/modules/appointments/status";
import { AppointmentStatus } from "@/modules/appointments/types";
import { useTRPC } from "@/trpc/client";
import { DASHBOARD_COPY as COPY } from "../constants";
import { arrivalPath } from "../rules";

interface AppointmentStatusControlProps {
  appointmentId: string;
  status: AppointmentStatus;
}

const isDestructive = (status: AppointmentStatus) =>
  status === AppointmentStatus.Canceled || status === AppointmentStatus.NoShow;

/**
 * A row's status, changed in place: a menu limited to the legal next
 * statuses, and «Arrivé» as one click on a `planned` / `confirmed` row.
 *
 * The menu READS the appointments slice's transition table to decide what to
 * offer; `appointments.updateStatus` enforces it whatever is clicked. The
 * table has no `planned → arrived` edge, so «Arrivé» on a planned row is the
 * two legal moves in order (confirm, then arrive), each checked by the
 * server. A terminal row (completed, no_show) gets its badge and no menu.
 *
 * Invalidation is the appointments slice's shared hook, which refreshes the
 * dashboard too — the waiting count rises without a reload.
 */
export const AppointmentStatusControl = ({
  appointmentId,
  status,
}: AppointmentStatusControlProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointments();

  // Both moves are terminal — there is no way back — so each is confirmed,
  // with the appointments slice's own copy.
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
    trpc.appointments.updateStatus.mutationOptions(),
  );

  const moves = nextStatuses(status);
  const toArrival = arrivalPath(status);

  /** Runs the moves in order; stops at the first refusal. */
  const run = async (path: AppointmentStatus[]) => {
    try {
      for (const next of path) {
        await updateStatus.mutateAsync({ id: appointmentId, status: next });
      }
      toast.success(APPOINTMENT_STATUS_TOASTS[path[path.length - 1]]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      // Also after a refusal: a CONFLICT means someone moved it first, and a
      // half-done arrival left it `confirmed` — show what is really stored.
      await invalidateAll();
    }
  };

  const handleMove = async (next: AppointmentStatus) => {
    if (next === AppointmentStatus.Canceled && !(await confirmCancel())) return;
    if (next === AppointmentStatus.NoShow && !(await confirmNoShow())) return;
    await run([next]);
  };

  const isPending = updateStatus.isPending;
  const badge = (
    <StatusBadge
      label={APPOINTMENT_STATUS_LABELS[status]}
      tone={APPOINTMENT_STATUS_TONES[status]}
    />
  );

  return (
    <div className="flex items-center justify-end gap-1.5">
      <CancelConfirmation />
      <NoShowConfirmation />

      {moves.length === 0 ? (
        badge
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="h-auto gap-1 px-1 py-0.5"
                aria-label={`${COPY.statusMenu} (${APPOINTMENT_STATUS_LABELS[status]})`}
              />
            }
          >
            {badge}
            {isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <ChevronDownIcon className="text-muted-foreground size-3.5" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {moves.map((next) => (
              <DropdownMenuItem
                key={next}
                variant={isDestructive(next) ? "destructive" : "default"}
                onClick={() => void handleMove(next)}
              >
                {APPOINTMENT_STATUS_ACTION_LABELS[next]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {toArrival.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => void run(toArrival)}
        >
          <ArmchairIcon />
          {COPY.markArrived}
        </Button>
      )}
    </div>
  );
};
