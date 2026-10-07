import { clinicInstant, toClinicDate, toClinicWallClock } from "@/lib/time";
import type { TreatmentFormValues, TreatmentValues } from "./schemas";
import { TreatmentStatus, type TreatmentListItem } from "./types";

/**
 * The one place an acte's `performedAt` instant and the form's wall-clock
 * fields are converted, both directions — through the clinic timezone
 * (`TZDate`), never the browser's.
 */

/** The patient as the picker labels it — before any search returns it. */
export interface TreatmentPatientOption {
  id: string;
  shortCode: string;
  firstName: string;
  lastName: string;
}

/**
 * Create-mode pre-fill. The V1.1 odontogram opens the form with `teeth`
 * preselected; the dossier with its own patient. Never flips the form into
 * edit mode: that is `initialValues`' job alone.
 */
export interface TreatmentFormDefaults {
  patient?: TreatmentPatientOption;
  teeth?: string[];
  practitionerId?: string | null;
  appointmentId?: string | null;
  status?: TreatmentStatus;
}

/** A stored acte read back for the inputs, or a blank form from the defaults. */
export const toFormValues = (
  treatment?: TreatmentListItem,
  defaults?: TreatmentFormDefaults,
): TreatmentFormValues => {
  if (treatment) {
    return {
      patientId: treatment.patientId,
      serviceId: treatment.serviceId,
      label: treatment.label,
      nomenclatureCode: treatment.nomenclatureCode ?? "",
      // The column is opaque jsonb; the schema re-validates on submit.
      teeth: treatment.teeth as TreatmentFormValues["teeth"],
      totalAmountCents: treatment.totalAmountCents,
      status: treatment.status as TreatmentStatus,
      practitionerId: treatment.practitionerId,
      appointmentId: treatment.appointmentId,
      performedDate: treatment.performedAt
        ? toClinicDate(treatment.performedAt)
        : "",
      performedTime: treatment.performedAt
        ? toClinicWallClock(treatment.performedAt)
        : "",
      notes: treatment.notes ?? "",
    };
  }

  return {
    patientId: defaults?.patient?.id ?? "",
    serviceId: null,
    label: "",
    nomenclatureCode: "",
    teeth: (defaults?.teeth ?? []) as TreatmentFormValues["teeth"],
    totalAmountCents: null,
    status: defaults?.status ?? TreatmentStatus.Completed,
    practitionerId: defaults?.practitionerId ?? null,
    appointmentId: defaults?.appointmentId ?? null,
    performedDate: "",
    performedTime: "",
    notes: "",
  };
};

/**
 * The instant stored for the submitted fields, run by the procedure. A
 * `completed` acte with no date was done now; any other status with no date
 * stays undated (a plan, or work not yet dated).
 */
export const resolvePerformedAt = (
  { performedDate, performedTime, status }: Pick<
    TreatmentValues,
    "performedDate" | "performedTime" | "status"
  >,
  now: Date = new Date(),
): Date | null => {
  if (performedDate && performedTime) {
    return clinicInstant(performedDate, performedTime);
  }
  return status === TreatmentStatus.Completed ? now : null;
};
