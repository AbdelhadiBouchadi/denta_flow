import {
  clinicInstant,
  toClinicDate,
  toClinicWallClock,
  type ClinicDateInput,
} from "@/lib/time";
import type { PaymentFormValues, PaymentValues } from "./schemas";
import { PaymentMethod, type PaymentListItem } from "./types";

/**
 * The one place a payment's `paidAt` instant and the form's wall-clock fields
 * are converted, both directions — through the clinic timezone (`TZDate`),
 * never the browser's.
 */

/** The patient as the picker labels it — before any search returns it. */
export interface PaymentPatientOption {
  id: string;
  shortCode: string;
  firstName: string;
  lastName: string;
  /** Their insurer, the default when the method is «Assurance». */
  insurerId?: string | null;
}

/** Create-mode pre-fill: the dossier's patient. Never flips to edit mode. */
export interface PaymentFormDefaults {
  patient?: PaymentPatientOption;
  treatmentId?: string | null;
}

/**
 * A stored payment read back for the inputs, or a blank form dated now on
 * the clinic's wall clock.
 */
export const toFormValues = (
  payment?: PaymentListItem,
  defaults?: PaymentFormDefaults,
  now: ClinicDateInput = new Date(),
): PaymentFormValues => {
  if (payment) {
    return {
      patientId: payment.patientId,
      amountCents: payment.amountCents,
      method: payment.method as PaymentMethod,
      paidDate: toClinicDate(payment.paidAt),
      paidTime: toClinicWallClock(payment.paidAt),
      treatmentId: payment.treatmentId,
      insurerId: payment.insurerId,
      reference: payment.reference ?? "",
      notes: payment.notes ?? "",
    };
  }

  return {
    patientId: defaults?.patient?.id ?? "",
    amountCents: null,
    method: PaymentMethod.Cash,
    paidDate: toClinicDate(now),
    paidTime: toClinicWallClock(now),
    treatmentId: defaults?.treatmentId ?? null,
    insurerId: null,
    reference: "",
    notes: "",
  };
};

/** The instant stored for the submitted fields, run by the procedure. */
export const resolvePaidAt = ({
  paidDate,
  paidTime,
}: Pick<PaymentValues, "paidDate" | "paidTime">): Date =>
  clinicInstant(paidDate, paidTime);
