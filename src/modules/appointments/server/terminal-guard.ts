import { TRPCError } from "@trpc/server";

import { terminalEditMessage } from "../constants";
import { isTerminalStatus } from "../status";
import type { AppointmentStatus } from "../types";

/** What a booking is, as far as the terminal guard is concerned. */
export interface BookingCore {
  patientId: string;
  practitionerId: string | null;
  typeId: string | null;
  startsAt: Date;
  endsAt: Date;
}

/**
 * True when `next` changes anything but the free text: the time, the
 * duration, the practitioner, the type or the patient.
 */
export const changesBookingCore = (existing: BookingCore, next: BookingCore) =>
  existing.patientId !== next.patientId ||
  existing.practitionerId !== next.practitionerId ||
  existing.typeId !== next.typeId ||
  existing.startsAt.getTime() !== next.startsAt.getTime() ||
  existing.endsAt.getTime() !== next.endsAt.getTime();

/**
 * A `completed`, `canceled` or `no_show` appointment is history: only its
 * `reason` and `notes` may still be edited (prompts/16-appointments.md). Any
 * other change is a BAD_REQUEST — from the form, a drag on the agenda, or a
 * hand-made request alike. Enforced in the procedure, never only in the UI.
 */
export const assertEditableBooking = (
  status: AppointmentStatus,
  existing: BookingCore,
  next: BookingCore,
) => {
  if (isTerminalStatus(status) && changesBookingCore(existing, next)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: terminalEditMessage(status),
    });
  }
};
