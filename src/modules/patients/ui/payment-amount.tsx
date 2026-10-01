import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaymentStatus } from "../types";

/**
 * An amount tinted by the patient's payment standing — the «Reste à payer»
 * figure in the list and the money stats on the dossier are the same component,
 * so the two screens can never disagree about what red means.
 *
 * Colours are the §4 payment palette, read from the design tokens.
 */
const PAYMENT_TONE_TEXT: Record<PaymentStatus, string> = {
  [PaymentStatus.Paid]: "text-success-strong",
  [PaymentStatus.Partial]: "text-warning-strong",
  [PaymentStatus.Unpaid]: "text-danger-strong",
  [PaymentStatus.Advance]: "text-info-strong",
  [PaymentStatus.NoCharges]: "text-muted-foreground",
};

interface PaymentAmountProps {
  /** Integer centimes. Negative is an «Avance» and is never clamped. */
  cents: number;
  status: PaymentStatus;
  className?: string;
}

/** `tabular-nums` is mandatory: amounts stack in a column (06-ui.md §2). */
export const PaymentAmount = ({
  cents,
  status,
  className,
}: PaymentAmountProps) => (
  <span
    className={cn(
      "font-medium tabular-nums",
      PAYMENT_TONE_TEXT[status],
      className,
    )}
  >
    {formatDH(cents)}
  </span>
);
