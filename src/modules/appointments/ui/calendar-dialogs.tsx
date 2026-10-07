"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { APPOINTMENT_COPY } from "../constants";
import type { AppointmentGetMany } from "../types";
import { AppointmentForm } from "./appointment-form";
import type { CalendarDialogIntent } from "./calendar-adapter";
import NewAppointmentDialog from "./new-appointment-dialog";

interface CalendarDialogsProps {
  intent: CalendarDialogIntent;
  onClose: () => void;
  /** The rows the agenda was drawn from: a clicked block is looked up here. */
  appointments: AppointmentGetMany;
  /** The toolbar's practitioner filter; "" for everybody. */
  practitionerId: string;
}

/**
 * What the agenda's `renderDialog` shows — one function, three cases:
 *
 * - «Nouveau rendez-vous» → the new-appointment dialog, pre-filled with the
 *   filtered practitioner only;
 * - an empty slot → the same dialog, pre-filled with the slot's start too;
 * - a block → the side `Sheet` with the one form in edit mode. This `Sheet`
 *   is the one sanctioned exception to `ResponsiveDialog` (06-ui.md §7,
 *   07-calendar.md §6). It closes on save; on an error the form stays open.
 */
export const CalendarDialogs = ({
  intent,
  onClose,
  appointments,
  practitionerId,
}: CalendarDialogsProps) => {
  const editing =
    intent.kind === "edit"
      ? appointments.find((appointment) => appointment.id === intent.id)
      : undefined;
  const isCreating = intent.kind === "new" || intent.kind === "slot";

  const close = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <NewAppointmentDialog
        open={isCreating}
        onOpenChange={close}
        defaultValues={{
          practitionerId: practitionerId || undefined,
          ...(intent.kind === "slot" && {
            date: intent.date,
            time: intent.time,
          }),
        }}
      />

      <Sheet open={editing !== undefined} onOpenChange={close}>
        {/* The primitive sizes itself with `data-[side=right]:w-3/4` and
            `data-[side=right]:sm:max-w-sm`. A plain `w-full sm:max-w-lg`
            neither merges with those (different variants) nor beats them
            (the attribute selector is more specific): the sheet stayed
            24rem. Overrides must carry the same variant. */}
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{APPOINTMENT_COPY.editTitle}</SheetTitle>
            <SheetDescription>
              {APPOINTMENT_COPY.editDescription}
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <AppointmentForm
              // A different block is a different booking: fresh form state.
              key={editing.id}
              initialValues={editing}
              onSuccess={onClose}
              onCancel={onClose}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
