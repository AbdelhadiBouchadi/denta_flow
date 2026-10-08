import { describeBalance, formatDH } from "@/lib/format";
import { TREATMENT_SUMMARY_LABELS as S } from "@/modules/treatments/constants";
import { getPaymentStatus } from "../derived";
import type { PatientGetOne } from "../types";
import { PaymentAmount } from "./payment-amount";

interface BalanceStripProps {
  patient: PatientGetOne;
}

/**
 * Total à payer · Payé · Reste à payer — or «Avance» and its absolute value
 * when the patient paid ahead (`describeBalance`, never clamped), plus Prévu
 * when there is a plan.
 *
 * ONE component for the dossier's «Actes» and «Paiements» tabs, fed by the
 * same `patients.getOne`, so the two tabs can never disagree. Every figure is
 * derived in SQL; nothing is subtracted here (08-clinical.md §3).
 */
const BalanceStrip = ({ patient }: BalanceStripProps) => {
  const paymentStatus = getPaymentStatus(patient);

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t pt-4 text-sm">
      {patient.plannedAmountCents !== 0 && (
        <SummaryFigure label={S.planned}>
          <span className="text-muted-foreground font-medium tabular-nums">
            {formatDH(patient.plannedAmountCents)}
          </span>
        </SummaryFigure>
      )}
      <SummaryFigure label={S.total}>
        <span className="font-medium tabular-nums">
          {formatDH(patient.totalAmountCents)}
        </span>
      </SummaryFigure>
      <SummaryFigure label={S.paid}>
        <span className="text-success-strong font-medium tabular-nums">
          {formatDH(patient.amountPaidCents)}
        </span>
      </SummaryFigure>
      <SummaryFigure label={describeBalance(patient.remainingCents).label}>
        <PaymentAmount cents={patient.remainingCents} status={paymentStatus} />
      </SummaryFigure>
    </div>
  );
};

const SummaryFigure = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <span className="flex items-center gap-2">
    <span className="text-muted-foreground">{label}&nbsp;:</span>
    {children}
  </span>
);

export default BalanceStrip;
