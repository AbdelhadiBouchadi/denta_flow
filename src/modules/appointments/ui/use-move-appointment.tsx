"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_COPY, BOOKING_WARNING_LABELS } from "../constants";
import { useInvalidateAppointments } from "../hooks/use-invalidate-appointments";
import type { AppointmentGetMany, BookingWarning } from "../types";

/** The confirm dialog's closing question, after the warnings themselves. */
const MOVE_ANYWAY = "Déplacer tout de même ce rendez-vous ?";

/** Where a block was dropped, on the clinic's wall clock (from the adapter). */
interface AppointmentMove {
  id: string;
  date: string;
  time: string;
}

/**
 * A drag on the agenda → `appointments.update`.
 *
 * The calendar keeps no copy of the events and does no optimistic update, and
 * neither do we: every outcome ends in the one invalidation block, and the
 * refetch puts the block where the server says it is — moved, or back.
 *
 * - `saved` → invalidate.
 * - `needs_confirmation` (out of hours) → the warnings in a confirm dialog.
 *   Confirm resends with `confirmOutOfHours` and the SAME version token —
 *   nothing was written, so the row has not moved on. Cancel invalidates,
 *   and the block snaps back.
 * - any error — CONFLICT (slot taken, or the row changed meanwhile) or a
 *   rule the server enforces — the server's French message, then invalidate.
 */
export const useMoveAppointment = (appointments: AppointmentGetMany) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointments();
  const update = useMutation(trpc.appointments.update.mutationOptions());

  const [warnings, setWarnings] = useState<BookingWarning[]>([]);
  const [ConfirmDialog, confirm] = useConfirm(
    APPOINTMENT_COPY.warningTitle,
    [
      ...warnings.map((warning) => BOOKING_WARNING_LABELS[warning]),
      MOVE_ANYWAY,
    ].join(" "),
  );

  const move = async ({ id, date, time }: AppointmentMove) => {
    // The block carries only its id: everything else — and the version
    // token — comes from the row the agenda was drawn from.
    const source = appointments.find((appointment) => appointment.id === id);
    if (!source) return;

    // The full payload: `update` rewrites every field, so a move must resend
    // what the row already holds. The duration is preserved, never resized.
    const payload = {
      id,
      expectedUpdatedAt: source.updatedAt,
      patientId: source.patientId,
      practitionerId: source.practitionerId ?? "",
      typeId: source.typeId,
      date,
      time,
      durationMinutes: Math.round(
        (source.endsAt.getTime() - source.startsAt.getTime()) / 60_000,
      ),
      reason: source.reason,
      notes: source.notes,
      confirmOutOfHours: false,
    };

    try {
      let result = await update.mutateAsync(payload);

      if (result.requiresConfirmation) {
        setWarnings(result.warnings);
        if (!(await confirm())) {
          await invalidateAll();
          return;
        }
        result = await update.mutateAsync({
          ...payload,
          confirmOutOfHours: true,
        });
      }

      await invalidateAll();
      if (!result.requiresConfirmation) toast.success(APPOINTMENT_COPY.updated);
    } catch (error) {
      toast.error(getErrorMessage(error));
      await invalidateAll();
    }
  };

  return [ConfirmDialog, move] as const;
};
