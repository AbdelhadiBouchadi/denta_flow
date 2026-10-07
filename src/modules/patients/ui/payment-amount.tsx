import BalanceAmount from "@/components/shared/balance-amount";
import { PaymentStatus } from "../types";

/**
 * The patient's balance, tinted by their payment standing — the «Reste à
 * payer» figure in the list, the dossier header and the actes strip are the
 * same component, so the screens can never disagree about what red means.
 *
 * Presented through `describeBalance` (via BalanceAmount): an overpayment
 * reads «Avance» and its absolute value, in the info tone — never red, never
 * a minus sign. Colours are the §4 payment palette, from the design tokens.
 */
const PAYMENT_TONE_TEXT: Record<PaymentStatus, string> = {
  [PaymentStatus.Paid]: "text-success-strong",
  [PaymentStatus.Partial]: "text-warning-strong",
  [PaymentStatus.Unpaid]: "text-danger-strong",
  [PaymentStatus.Advance]: "text-info-strong",
  [PaymentStatus.NoCharges]: "text-muted-foreground",
};

interface PaymentAmountProps {
  /** `remainingCents`, integer centimes. Negative is an «Avance», never clamped. */
  cents: number;
  status: PaymentStatus;
  /** Prefix an «Avance» with its label — where the heading says «Reste à payer». */
  showCreditLabel?: boolean;
  className?: string;
}

export const PaymentAmount = ({
  cents,
  status,
  showCreditLabel,
  className,
}: PaymentAmountProps) => (
  <BalanceAmount
    remainingCents={cents}
    showCreditLabel={showCreditLabel}
    dueClassName={PAYMENT_TONE_TEXT[status]}
    className={className}
  />
);
