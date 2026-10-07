import {
  clinicInstant,
  clinicNow,
  toClinicDate,
  toClinicWallClock,
} from "@/lib/time";
import { APPOINTMENT_DEFAULT_DURATION } from "./constants";
import type { AppointmentFormValues } from "./schemas";
import type { AppointmentListItem } from "./types";

/**
 * The one place a booking's instants and the form's wall-clock fields are
 * converted, both directions. The form reads a stored booking through
 * `toFormValues`; the procedure turns the submitted fields back into instants
 * through `fromFormSlot`. Both go through the clinic timezone (`TZDate`), never
 * the browser's — so a form saved untouched names the same instants it loaded,
 * wherever the browser is.
 */

/** The patient as the picker labels it — before any search returns it. */
export interface AppointmentPatientOption {
  id: string;
  shortCode: string;
  firstName: string;
  lastName: string;
}

/**
 * Create-mode pre-fill — an agenda slot, the practitioner filter, a patient
 * picked elsewhere. Never flips the form into edit mode: that is
 * `initialValues`' job alone.
 */
export interface AppointmentFormDefaults {
  date?: string;
  time?: string;
  practitionerId?: string;
  patient?: AppointmentPatientOption;
}

/** What `toFormValues` reads off a stored booking. */
export type AppointmentFormSource = Pick<
  AppointmentListItem,
  | "patientId"
  | "practitionerId"
  | "typeId"
  | "startsAt"
  | "endsAt"
  | "reason"
  | "notes"
>;

const MINUTE_MS = 60_000;

/**
 * A stored booking read back on the clinic's wall clock, for the inputs — or,
 * with no booking, a blank form seeded from the create-mode defaults. The date
 * is the CLINIC calendar day of `startsAt`, never the UTC or browser day.
 */
export const toFormValues = (
  appointment?: AppointmentFormSource,
  defaults?: AppointmentFormDefaults,
): AppointmentFormValues => ({
  patientId: appointment?.patientId ?? defaults?.patient?.id ?? "",
  practitionerId: appointment?.practitionerId ?? defaults?.practitionerId ?? "",
  typeId: appointment?.typeId ?? null,
  date: appointment
    ? toClinicDate(appointment.startsAt)
    : (defaults?.date ?? toClinicDate(clinicNow())),
  time: appointment
    ? toClinicWallClock(appointment.startsAt)
    : (defaults?.time ?? ""),
  durationMinutes: appointment
    ? Math.round(
        (appointment.endsAt.getTime() - appointment.startsAt.getTime()) /
          MINUTE_MS,
      )
    : APPOINTMENT_DEFAULT_DURATION,
  reason: appointment?.reason ?? "",
  notes: appointment?.notes ?? "",
  confirmOutOfHours: false,
});

/**
 * The reverse, run by the procedure: the submitted clinic day + "HH:mm" and a
 * duration → the UTC instants they name in the clinic.
 */
export const fromFormSlot = (
  { date, time }: { date: string; time: string },
  durationMinutes: number,
) => {
  const startsAt = clinicInstant(date, time);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMinutes * MINUTE_MS),
  };
};
