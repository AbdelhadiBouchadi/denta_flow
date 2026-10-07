import { PRACTITIONER_ROLES } from "@/constants";
import type { CalendarView } from "../types";

/**
 * The agenda's `getMany` input, derived ONCE for the page's prefetch and the
 * view's query — the same discipline as `getRangeForView`. If the two built
 * it separately, a drift between them would be a cache miss with no error.
 *
 * The practitioner filter defaults to the signed-in practitioner, so the URL
 * needs a way to say «Tous les praticiens» explicitly: `ALL_PRACTITIONERS`.
 * An empty `practitionerId` means «the default», whatever that is for the
 * viewer — and the URL stays clean in the common case.
 */

/** The URL value for «Tous les praticiens» when the default is one person. */
export const ALL_PRACTITIONERS = "all";

interface SessionStaff {
  id: string;
  role: string;
  isActive: boolean;
}

/**
 * The viewer, if they are a practitioner the agenda can filter on (an active
 * staff member with a practitioner role); otherwise "" — everybody.
 */
export const defaultCalendarPractitioner = (staff: SessionStaff): string =>
  staff.isActive &&
  (PRACTITIONER_ROLES as readonly string[]).includes(staff.role)
    ? staff.id
    : "";

/** The practitioner the agenda shows: a real id, or "" for everybody. */
export const resolveCalendarPractitioner = (
  practitionerId: string,
  defaultPractitionerId: string,
): string =>
  practitionerId === ALL_PRACTITIONERS
    ? ""
    : practitionerId || defaultPractitionerId;

/** The reverse: a picked practitioner ("" = everybody) → the URL value. */
export const toPractitionerParam = (
  selected: string,
  defaultPractitionerId: string,
): string =>
  selected === defaultPractitionerId ? "" : selected || ALL_PRACTITIONERS;

/** `appointments.getMany`'s input — raw `date` and `view`, resolved practitioner. */
export const calendarQueryInput = (
  filters: { date: string; view: CalendarView; practitionerId: string },
  defaultPractitionerId: string,
) => ({
  date: filters.date,
  view: filters.view,
  practitionerId: resolveCalendarPractitioner(
    filters.practitionerId,
    defaultPractitionerId,
  ),
});
