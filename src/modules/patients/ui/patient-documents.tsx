"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { FilePlusIcon, FileSignatureIcon } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/format";
import {
  DOCUMENT_COLUMN_HEADERS as H,
  DOCUMENT_COPY,
} from "@/modules/documents/constants";
import {
  DocumentType,
  type DocumentListItem,
  type GeneratedDocumentType,
} from "@/modules/documents/types";
import DocumentActions from "@/modules/documents/ui/document-actions";
import DocumentTypeBadge from "@/modules/documents/ui/document-type-badge";
import GenerateDocumentDialog, {
  useEligibleActes,
} from "@/modules/documents/ui/generate-document-dialog";
import { useTRPC } from "@/trpc/client";
import type { PatientGetOne } from "../types";

interface PatientDocumentsProps {
  patient: PatientGetOne;
}

/** Type · N° · Nom du fichier · Date · actions. */
const GRID =
  "md:grid-cols-[7rem_9rem_minmax(0,1fr)_7rem_2.5rem]";

/**
 * The dossier's «Documents» tab: the patient's documents from
 * `documents.getManyByPatient` (prefetched by the dossier page), and the two
 * generators. Each button is disabled, with the reason beside it, when the
 * patient has no acte the document could name.
 */
const PatientDocuments = ({ patient }: PatientDocumentsProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.documents.getManyByPatient.queryOptions({ patientId: patient.id }),
  );
  const billable = useEligibleActes(patient.id, DocumentType.Invoice);
  const planned = useEligibleActes(patient.id, DocumentType.Quote);
  // Dialog state, not page state.
  const [generating, setGenerating] = useState<GeneratedDocumentType | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-end gap-3">
        <GenerateButton
          icon={<FilePlusIcon />}
          label={DOCUMENT_COPY.generateQuote}
          reason={planned.length === 0 ? DOCUMENT_COPY.noPlanned : null}
          variant="outline"
          onClick={() => setGenerating(DocumentType.Quote)}
        />
        <GenerateButton
          icon={<FileSignatureIcon />}
          label={DOCUMENT_COPY.generateInvoice}
          reason={billable.length === 0 ? DOCUMENT_COPY.noBillable : null}
          onClick={() => setGenerating(DocumentType.Invoice)}
        />
      </div>

      {data.items.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={DOCUMENT_COPY.emptyTitle}
            description={DOCUMENT_COPY.emptyDefault}
          />
        </div>
      ) : (
        <ul
          data-slot="document-list"
          className="divide-border flex flex-col divide-y rounded-lg border"
        >
          <li
            aria-hidden="true"
            className={`text-muted-foreground hidden gap-x-4 px-4 py-2 text-xs font-medium md:grid ${GRID}`}
          >
            <span>{H.type}</span>
            <span>{H.number}</span>
            <span>{H.fileName}</span>
            <span>{H.date}</span>
            <span />
          </li>
          {data.items.map((item) => (
            <li key={item.id}>
              <DocumentRow item={item} />
            </li>
          ))}
        </ul>
      )}

      {data.total > data.items.length && (
        <p className="text-muted-foreground text-sm">
          {DOCUMENT_COPY.truncated(data.items.length, data.total)}
        </p>
      )}

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

const GenerateButton = ({
  icon,
  label,
  reason,
  variant = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  /** Why the button is disabled; null ⇒ enabled. */
  reason: string | null;
  variant?: "default" | "outline";
  onClick: () => void;
}) => (
  <div className="flex flex-col items-end gap-1">
    <Button size="lg" variant={variant} disabled={reason !== null} onClick={onClick}>
      {icon}
      {label}
    </Button>
    {reason && <span className="text-muted-foreground text-xs">{reason}</span>}
  </div>
);

const DocumentRow = ({ item }: { item: DocumentListItem }) => (
  <div
    className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm ${GRID}`}
  >
    <span>
      <DocumentTypeBadge type={item.type as DocumentType} />
    </span>
    <span className="col-span-2 font-mono tabular-nums md:col-span-1">
      {item.number ?? DOCUMENT_COPY.noNumber}
    </span>
    <span className="text-muted-foreground col-span-2 text-xs break-all md:col-span-1">
      {item.fileName}
    </span>
    {/* Clinic wall clock; see the payments row on the warning. */}
    <span suppressHydrationWarning className="flex flex-col tabular-nums">
      <span className="font-medium whitespace-nowrap">
        {formatDate(item.createdAt)}
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatTime(item.createdAt)}
      </span>
    </span>
    <span className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
      <DocumentActions document={item} />
    </span>
  </div>
);

export default PatientDocuments;
