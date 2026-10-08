import { toClinicDate, type ClinicDateInput } from "@/lib/time";

/**
 * The slice's money and permission rules, free of `db` and `server-only` so
 * Vitest covers them. The procedures call exactly these; no component
 * re-implements them.
 */

/**
 * Whether a write needs the «avance» confirmation: the patient's balance
 * would end below zero, and THIS write is what moves it further down.
 *
 * `remainingCents` is the patient's balance as the server computed it in SQL
 * (patients.getOne's figure), payment included when editing one. The result
 * of the write is `remaining + previous − amount`. Exactly zero is settled,
 * not an advance; one centime past it needs confirmation. An edit that does
 * not raise the amount never asks — it cannot create a credit.
 */
export const needsAdvanceConfirmation = ({
  remainingCents,
  amountCents,
  previousAmountCents = 0,
}: {
  remainingCents: number;
  amountCents: number;
  /** The payment's stored amount on update; 0 on create. */
  previousAmountCents?: number;
}) =>
  amountCents > previousAmountCents &&
  remainingCents + previousAmountCents - amountCents < 0;

/**
 * What the confirm dialog reports: the share of THIS write that lands as an
 * advance — never more than the write adds. A patient already in credit who
 * pays 100 DH more is told 100 DH, not their whole credit.
 */
export const advanceExcessCents = ({
  remainingCents,
  amountCents,
  previousAmountCents = 0,
}: {
  remainingCents: number;
  amountCents: number;
  previousAmountCents?: number;
}) =>
  Math.max(
    0,
    Math.min(
      amountCents - previousAmountCents,
      amountCents - previousAmountCents - remainingCents,
    ),
  );

/**
 * Who may edit a payment (prompts/20-paiements.md, rule 4): the admin, or the
 * staff member who entered it, on the same clinic day it was entered. The
 * day is read on the clinic's wall clock — never the server's UTC day.
 */
export const canEditPayment = ({
  isAdmin,
  staffId,
  createdByStaffId,
  createdAt,
  now = new Date(),
}: {
  isAdmin: boolean;
  staffId: string;
  createdByStaffId: string | null;
  createdAt: ClinicDateInput;
  now?: ClinicDateInput;
}) =>
  isAdmin ||
  (createdByStaffId === staffId &&
    toClinicDate(createdAt) === toClinicDate(now));
