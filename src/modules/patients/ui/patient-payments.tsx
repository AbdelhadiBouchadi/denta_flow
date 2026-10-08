"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate, formatDH, formatTime } from "@/lib/format";
import {
  PAYMENT_COLUMN_HEADERS as H,
  PAYMENT_COPY,
  PAYMENT_METHOD_LABELS,
} from "@/modules/payments/constants";
import type {
  PaymentListItem,
  PaymentMethod,
} from "@/modules/payments/types";
import NewPaymentDialog from "@/modules/payments/ui/new-payment-dialog";
import PaymentActions from "@/modules/payments/ui/payment-actions";
import { useTRPC } from "@/trpc/client";
import type { PatientGetOne } from "../types";
import BalanceStrip from "./balance-strip";

interface PatientPaymentsProps {
  patient: PatientGetOne;
}

/** Date · Mode · Acte · Référence · Assurance · Montant · actions. */
const GRID =
  "md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_2.5rem]";

/**
 * The dossier's «Paiements» tab: «Nouveau paiement» with the patient locked,
 * the patient's payments from `payments.getManyByPatient` (prefetched by the
 * dossier page), and the SAME balance strip as the «Actes» tab — one
 * component on one `patients.getOne`, so the two tabs can never disagree.
 */
const PatientPayments = ({ patient }: PatientPaymentsProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.payments.getManyByPatient.queryOptions({ patientId: patient.id }),
  );
  // Dialog state, not page state.
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="lg" onClick={() => setIsCreating(true)}>
          <PlusIcon />
          {PAYMENT_COPY.dossierNewButton}
        </Button>
      </div>

      {data.items.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={PAYMENT_COPY.emptyTitle}
            description={PAYMENT_COPY.emptyDefault}
          />
        </div>
      ) : (
        <ul
          data-slot="payment-list"
          className="divide-border flex flex-col divide-y rounded-lg border"
        >
          <li
            aria-hidden="true"
            className={`text-muted-foreground hidden gap-x-4 px-4 py-2 text-xs font-medium md:grid ${GRID}`}
          >
            <span>{H.date}</span>
            <span>{H.method}</span>
            <span>{H.treatment}</span>
            <span>{H.reference}</span>
            <span>{H.insurer}</span>
            <span className="text-right">{H.amount}</span>
            <span />
          </li>
          {data.items.map((item) => (
            <li key={item.id}>
              <PaymentRow item={item} />
            </li>
          ))}
        </ul>
      )}

      {data.total > data.items.length && (
        <p className="text-muted-foreground text-sm">
          {PAYMENT_COPY.truncated(data.items.length, data.total)}
        </p>
      )}

      <BalanceStrip patient={patient} />

      <NewPaymentDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        defaultValues={{ patient }}
        lockPatient
      />
    </div>
  );
};

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

const PaymentRow = ({ item }: { item: PaymentListItem }) => (
  <div
    className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm ${GRID}`}
  >
    {/* Clinic wall clock; see the patients columns on the warning. The
        date and the time each hold one unbreakable line: «09 h 30» has
        spaces, and inline after the date it wrapped mid-token. */}
    <span suppressHydrationWarning className="flex flex-col tabular-nums">
      <span className="font-medium whitespace-nowrap">
        {formatDate(item.paidAt)}
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatTime(item.paidAt)}
      </span>
    </span>
    <span className="col-span-2 md:col-span-1">
      {PAYMENT_METHOD_LABELS[item.method as PaymentMethod]}
    </span>
    <span className="col-span-2 truncate md:col-span-1">
      {item.treatment?.label ?? <Muted>{PAYMENT_COPY.noTreatment}</Muted>}
    </span>
    <span className="col-span-2 truncate md:col-span-1">
      {item.reference ?? <Muted>{PAYMENT_COPY.noReference}</Muted>}
    </span>
    <span className="col-span-2 truncate md:col-span-1">
      {item.insurer?.name ?? <Muted>{PAYMENT_COPY.noInsurer}</Muted>}
    </span>
    <span className="col-start-2 row-start-1 font-medium tabular-nums md:col-start-auto md:row-start-auto md:text-right">
      {formatDH(item.amountCents)}
    </span>
    <span className="col-start-2 md:col-start-auto">
      <PaymentActions payment={item} />
    </span>
  </div>
);

export default PatientPayments;
