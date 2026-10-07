/**
 * Whether an archived patient blocks an acte write (prompts/19-actes.md,
 * follow-up §2). Free of `db` and `server-only` so Vitest covers it.
 *
 * - create: a new acte for an archived patient is refused — reactivate the
 *   dossier first.
 * - update with `patientId` unchanged: allowed. Staff must be able to correct
 *   an archived patient's history (a wrong amount, an acte to cancel).
 * - update that MOVES the acte onto an archived patient: refused, as a create.
 *
 * `remove` never reaches this guard: deleting is admin-only and works on any
 * acte.
 */
export const archivedPatientBlocksWrite = ({
  targetIsArchived,
  targetPatientId,
  existingPatientId,
}: {
  /** The patient the acte will belong to after the write. */
  targetIsArchived: boolean;
  targetPatientId: string;
  /** The acte's current patient on update; absent on create. */
  existingPatientId?: string;
}) => targetIsArchived && existingPatientId !== targetPatientId;
