import { describeBalance, formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BalanceAmountProps {
  /** Integer centimes as the server computed them. Negative is an «Avance». */
  remainingCents: number;
  /** Prefix an «Avance» with its label — for cells headed «Reste». */
  showCreditLabel?: boolean;
  /** The tone of an amount still owed; the caller knows the standing. */
  dueClassName?: string;
  className?: string;
}

/**
 * The one rendering of a balance, through `describeBalance`: an amount owed
 * as is, an overpayment as «Avance» and its absolute value in the calm info
 * tone — never a minus sign, never the danger red (08-clinical.md §3).
 * `tabular-nums` is mandatory: amounts stack in a column (06-ui.md §2).
 */
const BalanceAmount = ({
  remainingCents,
  showCreditLabel = false,
  dueClassName,
  className,
}: BalanceAmountProps) => {
  const balance = describeBalance(remainingCents);
  const isCredit = balance.kind === "credit";

  return (
    <span
      className={cn(
        "font-medium whitespace-nowrap tabular-nums",
        isCredit ? "text-info-strong" : dueClassName,
        className,
      )}
    >
      {showCreditLabel && isCredit && (
        <span className="mr-1.5 text-xs">{balance.label}</span>
      )}
      {formatDH(balance.amountCents)}
    </span>
  );
};

export default BalanceAmount;
