import { StaffRole } from "@/modules/staff/types";
import { IMAGING_ROLES, IMAGING_SERVER_ERRORS as E } from "./constants";

/**
 * Who may do what with patient images (prompts/31, decision 3), free of `db`
 * and `server-only` so Vitest covers it. The procedures and the routes are
 * the authority; the UI reads the same functions only to decide what to show
 * (AGENTS.md §1 rule 5).
 *
 * Each `…Denial` returns the French reason, or `null` when allowed.
 */

/** `undefined` while the client session is still loading: no rights. */
type Role = StaffRole | string | null | undefined;

interface WriteActor {
  role: Role;
  /** An archived dossier's images are read-only for everyone, as for actes. */
  patientIsArchived: boolean;
}

const isImagingRole = (role: Role) =>
  IMAGING_ROLES.includes(role as StaffRole);

/** Reading the list, a thumbnail or an original. */
export const imagingReadDenial = (role: Role) =>
  isImagingRole(role) ? null : E.forbidden;

/**
 * Upload and metadata edit. The role first — a secretary is told the tab is
 * not theirs, not that the dossier is archived.
 */
export const imagingWriteDenial = ({ role, patientIsArchived }: WriteActor) => {
  if (!isImagingRole(role)) return E.forbidden;
  if (patientIsArchived) return E.archived;
  return null;
};

/**
 * Soft delete: admin only (the procedure is an `adminProcedure` as well),
 * and never on an archived dossier.
 */
export const imagingRemoveDenial = ({ role, patientIsArchived }: WriteActor) => {
  if (role !== StaffRole.Admin) return E.removeForbidden;
  if (patientIsArchived) return E.archived;
  return null;
};

export const canReadImaging = (role: Role) => imagingReadDenial(role) === null;

export const canWriteImaging = (actor: WriteActor) =>
  imagingWriteDenial(actor) === null;

export const canRemoveImaging = (actor: WriteActor) =>
  imagingRemoveDenial(actor) === null;
