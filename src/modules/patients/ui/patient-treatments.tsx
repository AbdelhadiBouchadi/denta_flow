"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  FilePlusIcon,
  FileSignatureIcon,
  HistoryIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/shared/empty-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatDate, formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_COPY,
  DOCUMENT_TYPE_LABELS,
} from "@/modules/documents/constants";
import {
  DocumentType,
  type GeneratedDocumentType,
} from "@/modules/documents/types";
import GenerateDocumentDialog, {
  useEligibleActes,
} from "@/modules/documents/ui/generate-document-dialog";
import {
  TREATMENT_COLUMN_HEADERS as H,
  TREATMENT_COPY,
  TREATMENT_STATUS_LABELS,
  TREATMENT_STATUS_TONES,
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
import { usePatientTab } from "../hooks/use-patient-tab";
import { PatientTab, type PatientGetOne } from "../types";
import BalanceStrip from "./balance-strip";
import GenerateDocumentButton from "./generate-document-button";

/** The toolbar's document shortcuts — the reference's buttons under the actes. */
const COPY = {
  /** «Devis (2)»: the patient's documents of that type, removed ones excluded. */
  shortcut: (type: GeneratedDocumentType, count: number) =>
    `${DOCUMENT_TYPE_LABELS[type]} (${count})`,
  history: "Historique des documents",
} as const;

interface PatientTreatmentsProps {
  patient: PatientGetOne;
}

/**
 * The dossier's «Actes» tab — the reference layout without the chart (the
 * odontogram is V1.1): toolbar, the list, and the balance strip at the
 * bottom. The toolbar carries the document shortcuts: «Devis (N)» and
 * «Facture (N)» open branch 21's generate dialog — disabled, with the reason,
 * when no acte is eligible — and «Historique des documents» switches to the
 * «Documents» tab. N comes from `documents.countByPatient`, one grouped SQL
 * count, refreshed by the documents invalidation on every generate / remove. Actes come from `treatments.getManyByPatient` (prefetched by the
 * dossier page); the strip's figures from `patients.getOne`, the real
 * balance, derived in SQL.
 */
const PatientTreatments = ({ patient }: PatientTreatmentsProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.treatments.getManyByPatient.queryOptions({ patientId: patient.id }),
  );
  const { data: documentCounts } = useSuspenseQuery(
    trpc.documents.countByPatient.queryOptions({ patientId: patient.id }),
  );
  // The shared eligibility rule — the same the dialog itself lists.
  const planned = useEligibleActes(patient.id, DocumentType.Quote);
  const billable = useEligibleActes(patient.id, DocumentType.Invoice);
  const [search, setSearch] = useTreatmentSearch();
  const [, setTab] = usePatientTab();
  // Dialog state, not page state.
  const [isCreating, setIsCreating] = useState(false);
  const [generating, setGenerating] = useState<GeneratedDocumentType | null>(
    null,
  );

  const items = data.items.filter((item) =>
    matchesTreatmentSearch(item, search),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* `items-start`: a disabled shortcut carries its reason beneath it,
          and the other controls stay aligned on the button row. */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
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
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <GenerateDocumentButton
            variant="outline"
            icon={<FilePlusIcon />}
            label={COPY.shortcut(
              DocumentType.Quote,
              documentCounts[DocumentType.Quote],
            )}
            reason={planned.length === 0 ? DOCUMENT_COPY.noPlanned : null}
            onClick={() => setGenerating(DocumentType.Quote)}
          />
          <GenerateDocumentButton
            variant="outline"
            icon={<FileSignatureIcon />}
            label={COPY.shortcut(
              DocumentType.Invoice,
              documentCounts[DocumentType.Invoice],
            )}
            reason={billable.length === 0 ? DOCUMENT_COPY.noBillable : null}
            onClick={() => setGenerating(DocumentType.Invoice)}
          />
          <Button
            size="lg"
            variant="outline"
            onClick={() => void setTab(PatientTab.Documents)}
          >
            <HistoryIcon />
            {COPY.history}
          </Button>
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

      {/* Mounted while open only: each opening starts from «all selected». */}
      {generating && (
        <GenerateDocumentDialog
          type={generating}
          patientId={patient.id}
          open
          onOpenChange={(open) => {
            if (!open) setGenerating(null);
          }}
        />
      )}
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

export default PatientTreatments;
