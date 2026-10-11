import type { StaffRole } from "@/modules/staff/types";
import {
  ODONTOGRAM_RESETTER_ROLES,
  ODONTOGRAM_SERVER_ERRORS as E,
  ODONTOGRAM_WRITER_ROLES,
} from "./constants";

/**
 * The chart's rules, free of `db` and `server-only` so Vitest covers them.
 * The procedures are the authority; the UI reads the same functions only to
 * decide what to show (AGENTS.md §1 rule 5).
 */

interface Actor {
  /** `undefined` while the client session is still loading: no rights. */
  role: StaffRole | string | null | undefined;
  /** An archived dossier is read-only for everyone, as for its actes. */
  patientIsArchived: boolean;
}

/**
 * Why a save is refused, in French — or `null` when it is allowed. Archived
 * first: even an admin is told to reactivate the dossier, not about roles.
 */
export const odontogramWriteDenial = ({ role, patientIsArchived }: Actor) => {
  if (patientIsArchived) return E.archived;
  if (!ODONTOGRAM_WRITER_ROLES.includes(role as StaffRole)) {
    return E.writeForbidden;
  }
  return null;
};

/** Same order for a reset, which only an admin or a dentist may do. */
export const odontogramResetDenial = ({ role, patientIsArchived }: Actor) => {
  if (patientIsArchived) return E.archived;
  if (!ODONTOGRAM_RESETTER_ROLES.includes(role as StaffRole)) {
    return E.resetForbidden;
  }
  return null;
};

export const canWriteOdontogram = (actor: Actor) =>
  odontogramWriteDenial(actor) === null;

export const canResetOdontogram = (actor: Actor) =>
  odontogramResetDenial(actor) === null;

/**
 * The first-save rule (prompts/28, decision 1): the first save writes BOTH
 * layers — `initial` («situation initiale») is that first chart, and is never
 * written again; every later save writes `current` only. A reset deletes the
 * row, so the save after it is a first save again.
 */
export type ChartWrite<T> =
  | { kind: "insert"; initial: T; current: T }
  | { kind: "update"; id: string; current: T };

export const planChartWrite = <T>(
  existing: { id: string } | null,
  chart: T,
): ChartWrite<T> =>
  existing === null
    ? { kind: "insert", initial: chart, current: chart }
    : { kind: "update", id: existing.id, current: chart };

/**
 * Whether the editor's version token still describes the stored chart.
 * `null` means «I loaded no chart»: right only while there is still none.
 * The guarded UPDATE re-checks the timestamp itself; this decides the cases
 * the database cannot (a row created or deleted since the load).
 */
export const versionAgrees = (
  existing: { updatedAt: Date } | null,
  expectedUpdatedAt: Date | null,
) => (existing === null) === (expectedUpdatedAt === null);
