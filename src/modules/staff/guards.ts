import { STAFF_SERVER_ERRORS } from "./constants";
import { StaffChange, StaffRole } from "./types";

/**
 * The account guards of 02-auth.md §4, as pure functions so the copy and the
 * decisions are tested without a database. The procedures own the SQL; the
 * last-admin rule is enforced there in one conditional statement, and this
 * module only names the refusal.
 */

/**
 * The change a role write makes to the admin headcount. Granting `admin` never
 * removes one, so it needs no guard; any other role may.
 */
export const roleChangeKind = (role: StaffRole): StaffChange | null =>
  role === StaffRole.Admin ? null : StaffChange.Demote;

/** Nobody demotes or deactivates themselves. `null` ⇒ allowed. */
export const selfChangeError = (
  actorId: string,
  targetId: string,
  change: StaffChange | null,
): string | null => {
  if (change === null || actorId !== targetId) return null;
  return change === StaffChange.Demote
    ? STAFF_SERVER_ERRORS.selfDemote
    : STAFF_SERVER_ERRORS.selfDeactivate;
};

/** The refusal when the target is the clinic's last active admin. */
export const lastAdminError = (change: StaffChange): string =>
  change === StaffChange.Demote
    ? STAFF_SERVER_ERRORS.lastAdminDemote
    : STAFF_SERVER_ERRORS.lastAdminDeactivate;
