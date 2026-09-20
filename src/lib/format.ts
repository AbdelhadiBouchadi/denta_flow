import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { CURRENCY_SUFFIX } from "@/constants";
import { toClinicTime, type ClinicDateInput } from "@/lib/time";

/**
 * Every user-visible rendering of money, a date, a time, a phone number or a
 * tooth happens here. Never format inline — a bare `{amount}` in JSX is a bug.
 */

// Intl's separators are locale data, and locale data moves: "fr-MA" groups with
// a dot ("1.250,00") in current ICU, "fr-FR" with a narrow no-break space.
// Neither is the specified rendering, so the parts are reassembled by hand and
// the output is pinned to "1 250,00 DH" whatever ICU the runtime ships.
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const GROUP_SEPARATOR = " ";
const DECIMAL_SEPARATOR = ",";
const MINUS_SIGN = "-";

/** 125000 → "1 250,00 DH". Always two decimals, always the DH suffix. */
export const formatDH = (cents: number) => {
  const amount = AMOUNT_FORMATTER.formatToParts(cents / 100)
    .map((part) => {
      switch (part.type) {
        case "group":
          return GROUP_SEPARATOR;
        case "decimal":
          return DECIMAL_SEPARATOR;
        case "minusSign":
          return MINUS_SIGN;
        default:
          return part.value;
      }
    })
    .join("");

  return `${amount} ${CURRENCY_SUFFIX}`;
};

/**
 * "1 250,00" | "1250.5" → 125000. The single parse point for money input:
 * `MoneyInput` calls it, nothing else in the UI does.
 *
 * `\s` covers the no-break and narrow no-break spaces a paste from another
 * app carries. Returns `NaN` for input that is not a number at all — the
 * caller decides what an unparseable field means.
 */
export const parseDH = (input: string) => {
  const normalized = input.replace(/\s/g, "").replace(",", ".");

  if (normalized === "") return Number.NaN;

  return Math.round(Number(normalized) * 100);
};

/** 2026-06-15T12:00:00Z → "15/06/2026", read on the clinic's wall clock. */
export const formatDate = (d: ClinicDateInput) =>
  format(toClinicTime(d), "dd/MM/yyyy", { locale: fr });

/** 2026-06-15T12:00:00Z → "13 h 00", read on the clinic's wall clock. */
export const formatTime = (d: ClinicDateInput) =>
  format(toClinicTime(d), "HH' h 'mm", { locale: fr });

/** 2026-06-15T12:00:00Z → "15/06/2026 à 13 h 00". */
export const formatDateTime = (d: ClinicDateInput) =>
  `${formatDate(d)} à ${formatTime(d)}`;

/** "+212661234567" → "+212 6 61 23 45 67". Anything else passes through. */
export const formatPhone = (e164: string) =>
  e164.replace(
    /^(\+212)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/,
    "$1 $2 $3 $4 $5 $6",
  );

/** FDI notation: "26" → "Dent 26". */
export const formatTooth = (fdi: string) => `Dent ${fdi}`;
