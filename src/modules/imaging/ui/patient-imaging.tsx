"use client";

import {
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ImagePlusIcon, RotateCcwIcon } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";

import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  IMAGING_COPY as COPY,
  PATIENT_FILE_KIND_OPTIONS,
} from "../constants";
import { useImagingFilters } from "../hooks/use-imaging-filters";
import { canReadImaging, canRemoveImaging, canWriteImaging } from "../rules";
import type { PatientFileKind } from "../types";
import ImageViewer from "./image-viewer";
import ImagingTile, { ImagingTileSkeleton } from "./imaging-tile";
import UploadImagesDialog from "./upload-images-dialog";

/** What the tab needs of the dossier's `patients.getOne`. */
interface ImagingPatient {
  id: string;
  isArchived: boolean;
}

interface PatientImagingProps {
  patient: ImagingPatient;
}

/** 2 columns at 360 px, 3 on `md`, 4 on `xl`, 5 beyond. */
const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

/**
 * The dossier's «Imagerie» tab (prompts/31). Hidden from the secretary by the
 * dossier, and refused here as well — the procedures are the control.
 *
 * The gallery has its OWN Suspense and ErrorBoundary: a failed or slow image
 * list must never take the rest of the dossier down. Its query is prefetched
 * by the dossier page, so the first paint makes no tRPC call.
 */
const PatientImaging = ({ patient }: PatientImagingProps) => {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <ImagingGallerySkeleton />;

  const role = session?.user.role;
  if (!canReadImaging(role)) {
    return (
      <div className="py-6">
        <EmptyState
          title={COPY.forbiddenTitle}
          description={COPY.forbiddenDescription}
        />
      </div>
    );
  }

  const actor = { role, patientIsArchived: patient.isArchived };

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <div className="flex flex-col items-center gap-4 py-6">
              <ErrorState
                title={COPY.errorTitle}
                description={COPY.errorDescription}
              />
              <Button variant="outline" onClick={resetErrorBoundary}>
                <RotateCcwIcon />
                {COPY.retry}
              </Button>
            </div>
          )}
        >
          <Suspense fallback={<ImagingGallerySkeleton />}>
            <ImagingGallery
              patient={patient}
              canWrite={canWriteImaging(actor)}
              canRemove={canRemoveImaging(actor)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};

interface ImagingGalleryProps {
  patient: ImagingPatient;
  canWrite: boolean;
  canRemove: boolean;
}

const ImagingGallery = ({ patient, canWrite, canRemove }: ImagingGalleryProps) => {
  const trpc = useTRPC();
  const [filters, setFilters] = useImagingFilters();
  // A filter change suspends on a new key: inside a transition React keeps
  // the current grid on screen (dimmed) instead of the skeleton.
  const [isFiltering, startTransition] = useTransition();

  // The SAME input the dossier page prefetched — same key, cache hit.
  const { data } = useSuspenseQuery(
    trpc.imaging.getManyByPatient.queryOptions({
      patientId: patient.id,
      kind: filters.imageKind,
    }),
  );

  // Dialog and viewer state — UI state, not page state.
  const [uploading, setUploading] = useState(false);
  const [viewedId, setViewedId] = useState<string | null>(null);

  if (!data.storageConfigured) {
    return (
      <div className="py-6">
        <EmptyState
          title={COPY.notConfiguredTitle}
          description={COPY.notConfiguredDescription}
        />
      </div>
    );
  }

  const selectKind = (kind: PatientFileKind | null) =>
    void setFilters({ imageKind: kind }, { startTransition });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Chips scroll sideways on a phone rather than wrapping into rows. */}
        <div
          role="group"
          aria-label={COPY.filterLabel}
          className="[scrollbar-width:none] -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
        >
          <KindChip
            label={COPY.allKinds}
            active={filters.imageKind === null}
            onClick={() => selectKind(null)}
          />
          {PATIENT_FILE_KIND_OPTIONS.map((option) => (
            <KindChip
              key={option.value}
              label={option.label}
              active={filters.imageKind === option.value}
              onClick={() => selectKind(option.value)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <span className="text-muted-foreground text-sm tabular-nums">
            {COPY.count(data.total)}
          </span>
          {canWrite && (
            <Button size="lg" onClick={() => setUploading(true)}>
              <ImagePlusIcon />
              {COPY.addImages}
            </Button>
          )}
        </div>
      </div>

      {patient.isArchived && (
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-sm">
          {COPY.archivedNotice}
        </p>
      )}

      {data.items.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={COPY.emptyTitle}
            description={
              filters.imageKind ? COPY.emptyFilteredDescription : COPY.emptyDescription
            }
          />
        </div>
      ) : (
        <ul
          aria-busy={isFiltering}
          className={cn(GRID, "transition-opacity", isFiltering && "opacity-60")}
        >
          {data.items.map((file) => (
            <li key={file.id} className="min-w-0">
              <ImagingTile file={file} onOpen={() => setViewedId(file.id)} />
            </li>
          ))}
        </ul>
      )}

      {data.total > data.items.length && (
        <p className="text-muted-foreground text-sm">
          {COPY.truncated(data.items.length, data.total)}
        </p>
      )}

      <ImageViewer
        files={data.items}
        fileId={viewedId}
        onFileChange={setViewedId}
        canWrite={canWrite}
        canRemove={canRemove}
      />

      {/* Mounted while open only: each opening starts empty. */}
      {uploading && (
        <UploadImagesDialog
          patientId={patient.id}
          open
          onOpenChange={(open) => {
            if (!open) setUploading(false);
          }}
        />
      )}
    </div>
  );
};

const KindChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <Button
    type="button"
    size="sm"
    variant={active ? "default" : "outline"}
    aria-pressed={active}
    onClick={onClick}
    className="shrink-0 rounded-full"
  >
    {label}
  </Button>
);

const ImagingGallerySkeleton = () => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    <div className="flex gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="bg-muted h-7 w-20 animate-pulse rounded-full" />
      ))}
    </div>
    <div className={GRID}>
      {Array.from({ length: 8 }, (_, index) => (
        <ImagingTileSkeleton key={index} />
      ))}
    </div>
  </div>
);

export default PatientImaging;
