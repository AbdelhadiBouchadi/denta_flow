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

/** The two ways a balance reads (08-clinical.md §3). */
export const BALANCE_LABELS = {
  due: "Reste à payer",
  credit: "Avance",
} as const;

export type BalanceKind = keyof typeof BALANCE_LABELS;

export interface BalanceDescription {
  kind: BalanceKind;
  /** «Reste à payer» or «Avance» — already French. */
  label: string;
  /** Always ≥ 0: an «Avance» reads as a positive amount, never «−2 500,00 DH». */
  amountCents: number;
}

/**
 * How a `remainingCents` the SERVER computed is presented — every balance on
 * screen goes through this. It does no arithmetic on the figures: ≥ 0 is
 * owed («Reste à payer», 0,00 DH included); < 0 is an overpayment, an
 * «Avance», shown as its absolute value. Never clamped to zero.
 */
export const describeBalance = (remainingCents: number): BalanceDescription =>
  remainingCents < 0
    ? {
        kind: "credit",
        label: BALANCE_LABELS.credit,
        amountCents: Math.abs(remainingCents),
      }
    : { kind: "due", label: BALANCE_LABELS.due, amountCents: remainingCents };

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

/** 2026-10-08T10:00:00Z → "jeudi 8 octobre 2026", read on the clinic's wall clock. */
export const formatLongDate = (d: ClinicDateInput) =>
  format(toClinicTime(d), "EEEE d MMMM yyyy", { locale: fr });

/**
 * A calendar day "2026-10-02" → "02/10/2026". The value is already a clinic
 * day, not an instant, so it is reformatted as text and never goes through a
 * `Date`: `formatDate(parseISO(day))` takes the BROWSER's midnight and reads
 * it on the clinic clock — the day before, anywhere east of the clinic.
 */
export const formatCalendarDate = (day: string) => {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
};

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

/**
 * The pager's range: (2, 10, 87) → "11–20 sur 87". A page past the end
 * (after a delete) reads as the last real rows' bounds, never "91–87".
 */
export const formatPageRange = (
  page: number,
  pageSize: number,
  total: number,
) => {
  if (total <= 0) return "0 sur 0";
  const first = Math.min((page - 1) * pageSize + 1, total);
  const last = Math.min(page * pageSize, total);
  return `${first}–${last} sur ${total}`;
};
