import { AppointmentStatus } from "./types";

/**
 * The only legal moves of an appointment's status (08-clinical.md §4 rule 10):
 *
 *   planned → confirmed → arrived → completed
 *
 * `canceled` and `no_show` are terminal, reachable from any state still on
 * the books. A patient already in the waiting room can leave unseen
 * (`canceled`), but cannot fail to turn up (`no_show`). `completed` has no
 * successor either.
 *
 * Enforced by `appointments.updateStatus`; the UI only reads this table to
 * decide which actions to offer.
 */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  [AppointmentStatus.Planned]: [
    AppointmentStatus.Confirmed,
    AppointmentStatus.Canceled,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Confirmed]: [
    AppointmentStatus.Arrived,
    AppointmentStatus.Canceled,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Arrived]: [
    AppointmentStatus.Completed,
    AppointmentStatus.Canceled,
  ],
  [AppointmentStatus.Completed]: [],
  [AppointmentStatus.Canceled]: [],
  [AppointmentStatus.NoShow]: [],
};

export const canTransition = (
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean => APPOINTMENT_STATUS_TRANSITIONS[from].includes(to);

export const nextStatuses = (
  from: AppointmentStatus,
): readonly AppointmentStatus[] => APPOINTMENT_STATUS_TRANSITIONS[from];

export const isTerminalStatus = (status: AppointmentStatus): boolean =>
  APPOINTMENT_STATUS_TRANSITIONS[status].length === 0;
