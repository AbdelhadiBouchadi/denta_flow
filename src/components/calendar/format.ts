import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Every date the calendar renders goes through here, in French.
//
// Deliberately NOT `@/lib/format`: those helpers render in the clinic
// timezone, while this component lays events out at the browser's wall-clock.
// The adapter (src/modules/appointments/ui/calendar-adapter.ts) already hands
// us clinic-local Dates; formatting them through the clinic timezone again
// would shift them twice for any viewer outside Morocco.

/** date-fns `format` with the French locale. */
export const formatCalendarDate = (date: Date, pattern: string) =>
  format(date, pattern, { locale: fr });

/** 14:30 → "14 h 30". 24-hour, the way a French clinic reads it. */
export const formatCalendarTime = (date: Date) =>
  formatCalendarDate(date, "HH 'h' mm");

/** "janvier 2026" → "Janvier 2026": French month names are lowercase. */
export const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
