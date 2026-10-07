"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/shared/empty-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { describeBalance, formatDate, formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  TREATMENT_COLUMN_HEADERS as H,
  TREATMENT_COPY,
  TREATMENT_STATUS_LABELS,
  TREATMENT_STATUS_TONES,
  TREATMENT_SUMMARY_LABELS as S,
} from "@/modules/treatments/constants";
import { useTreatmentSearch } from "@/modules/treatments/hooks/use-treatment-search";
import {
  TreatmentStatus,
  type TreatmentListItem,
} from "@/modules/treatments/types";
import NewTreatmentDialog from "@/modules/treatments/ui/new-treatment-dialog";
import { TeethCell } from "@/modules/treatments/ui/teeth-cell";
import TreatmentActions from "@/modules/treatments/ui/treatment-actions";
import { TreatmentLabel } from "@/modules/treatments/ui/treatment-label";
import { matchesTreatmentSearch } from "@/modules/treatments/search";
import { useTRPC } from "@/trpc/client";
import { getPaymentStatus } from "../derived";
import type { PatientGetOne } from "../types";
import { PaymentAmount } from "./payment-amount";

interface PatientTreatmentsProps {
  patient: PatientGetOne;
}

/**
 * The dossier's «Actes» tab — the reference layout without the chart (the
 * odontogram is V1.1): toolbar, the list, and the balance strip at the
 * bottom. Actes come from `treatments.getManyByPatient` (prefetched by the
 * dossier page); the strip's figures from `patients.getOne`, the real
 * balance, derived in SQL.
 */
const PatientTreatments = ({ patient }: PatientTreatmentsProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.treatments.getManyByPatient.queryOptions({ patientId: patient.id }),
  );
  const [search, setSearch] = useTreatmentSearch();
  // Dialog state, not page state.
  const [isCreating, setIsCreating] = useState(false);

  const items = data.items.filter((item) =>
    matchesTreatmentSearch(item, search),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The right-hand group leaves room for the Devis / Facture buttons
          of branch 21. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="h-9 w-full max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={TREATMENT_COPY.dossierSearchPlaceholder}
            placeholder={TREATMENT_COPY.dossierSearchPlaceholder}
            value={search}
            onChange={(event) => void setSearch(event.target.value)}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => setIsCreating(true)}>
            <PlusIcon />
            {TREATMENT_COPY.newButton}
          </Button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={TREATMENT_COPY.emptyTitle}
            description={TREATMENT_COPY.emptyDefault}
          />
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {TREATMENT_COPY.emptyDossierSearch}
        </p>
      ) : (
        <ul
          data-slot="treatment-list"
          className="divide-border flex flex-col divide-y rounded-lg border"
        >
          <li
            aria-hidden="true"
            className="text-muted-foreground hidden grid-cols-[6rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_6.5rem_2.5rem] gap-x-4 px-4 py-2 text-xs font-medium md:grid"
          >
            <span>{H.date}</span>
            <span>{H.label}</span>
            <span>{H.teeth}</span>
            <span>{H.practitioner}</span>
            <span className="text-right">{H.amount}</span>
            <span>{H.status}</span>
            <span />
          </li>
          {items.map((item) => (
            <li key={item.id}>
              <TreatmentRow item={item} />
            </li>
          ))}
        </ul>
      )}

      {data.total > data.items.length && (
        <p className="text-muted-foreground text-sm">
          {TREATMENT_COPY.truncated(data.items.length, data.total)}
        </p>
      )}

      <BalanceStrip patient={patient} />

      <NewTreatmentDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        defaultValues={{ patient }}
        lockPatient
      />
    </div>
  );
};

const TreatmentRow = ({ item }: { item: TreatmentListItem }) => {
  const status = item.status as TreatmentStatus;
  const canceled = status === TreatmentStatus.Canceled;

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm md:grid-cols-[6rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_6.5rem_2.5rem]",
        canceled && "text-muted-foreground",
      )}
    >
      {/* Clinic wall clock; see the patients columns on the warning. */}
      <span suppressHydrationWarning className="font-medium tabular-nums">
        {formatDate(item.listedAt)}
      </span>
      <span className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
        <TreatmentLabel treatment={item} struck={canceled} />
      </span>
      <span className="col-span-2 md:col-span-1">
        <TeethCell teeth={item.teeth} />
      </span>
      <span className="col-span-2 truncate md:col-span-1">
        {item.practitioner?.name ?? (
          <span className="text-muted-foreground">
            {TREATMENT_COPY.noPractitioner}
          </span>
        )}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums md:text-right",
          canceled && "line-through",
        )}
      >
        {formatDH(item.totalAmountCents)}
      </span>
      <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
        <StatusBadge
          label={TREATMENT_STATUS_LABELS[status]}
          tone={TREATMENT_STATUS_TONES[status]}
        />
      </span>
      <span className="col-start-2 row-start-4 md:col-start-auto md:row-start-auto">
        <TreatmentActions treatment={item} />
      </span>
    </div>
  );
};

/**
 * Total à payer · Payé · Reste à payer — or «Avance» and its absolute value
 * when the patient paid ahead (`describeBalance`, never clamped),
 * plus Prévu when there is a plan. Every figure is derived in SQL by
 * `patients.getOne`; nothing is subtracted here (08-clinical.md §3).
 */
const BalanceStrip = ({ patient }: PatientTreatmentsProps) => {
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

export default PatientTreatments;
