"use client";

import {
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ColumnsIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { Suspense, useMemo, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";

import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { ToothCode } from "@/modules/odontogram/constants";
import { useTRPC } from "@/trpc/client";
import {
  IMAGING_COMPARE_MAX,
  IMAGING_COPY as COPY,
  IMAGING_GROUP_BY_LABELS,
  IMAGING_GROUP_BY_VALUES,
  PATIENT_FILE_KIND_GROUP_LABELS,
  PATIENT_FILE_KIND_ORDER,
} from "../constants";
import { flattenGroups, groupFiles, toggleCompareSelection } from "../gallery";
import { useImagingFilters } from "../hooks/use-imaging-filters";
import { canReadImaging, canRemoveImaging, canWriteImaging } from "../rules";
import type { ImagingFile, ImagingGroupBy, PatientFileKind } from "../types";
import CompareView from "./compare-view";
import ImageViewer from "./image-viewer";
import ImagingGroups, { IMAGING_GRID } from "./imaging-groups";
import { ImagingTileSkeleton } from "./imaging-tile";
import ToothFilter from "./tooth-filter";
import UploadImagesDialog from "./upload-images-dialog";

/** What the tab needs of the dossier's `patients.getOne`. */
interface ImagingPatient {
  id: string;
  isArchived: boolean;
}

interface PatientImagingProps {
  patient: ImagingPatient;
}

/**
 * The dossier's «Imagerie» tab (prompts/31, polished by prompts/32). Hidden
 * from the secretary by the dossier, and refused here as well — the
 * procedures are the control.
 *
 * The gallery has its OWN Suspense and ErrorBoundary: a failed or slow image
 * list must never take the rest of the dossier down. Both of its queries
 * (the rows and the chips' counts) are prefetched by the dossier page with
 * the same inputs, so the first paint makes no tRPC call.
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

  // The SAME inputs the dossier page prefetched — same keys, cache hits.
  const { data } = useSuspenseQuery(
    trpc.imaging.getManyByPatient.queryOptions({
      patientId: patient.id,
      kind: filters.imageKind,
      tooth: filters.imageTooth,
    }),
  );
  const { data: counts } = useSuspenseQuery(
    trpc.imaging.getCountsByPatient.queryOptions({ patientId: patient.id }),
  );

  // Dialog, viewer, folding and compare state — UI state, not page state.
  const [uploading, setUploading] = useState(false);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  // Grouping is a view of the rows already returned (decision 2): no query.
  const groups = useMemo(
    () => groupFiles(data.items, filters.imageGroup, new Date()),
    [data.items, filters.imageGroup],
  );
  // The order the viewer and its filmstrip walk: the grid's, top to bottom.
  const ordered = useMemo(() => flattenGroups(groups), [groups]);

  // A pick that left the list (re-filtered, removed) is no longer selected.
  const selectedFiles = selectedIds
    .map((id) => data.items.find((file) => file.id === id))
    .filter((file): file is ImagingFile => file !== undefined);

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

  const isFiltered = filters.imageKind !== null || filters.imageTooth !== null;

  const setFilter = (patch: {
    imageKind?: PatientFileKind | null;
    imageTooth?: ToothCode | null;
    imageGroup?: ImagingGroupBy;
  }) => void setFilters(patch, { startTransition });

  const toggleGroup = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const activate = (file: ImagingFile) => {
    if (!selecting) {
      setViewedId(file.id);
      return;
    }
    const next = toggleCompareSelection(
      selectedFiles.map((item) => item.id),
      file.id,
    );
    if (next.refused) toast.info(COPY.compareTooMany);
    setSelectedIds(next.selected);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Toolbar: wraps on a phone, never scrolls sideways. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={COPY.filterLabel}
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <KindChip
            label={COPY.chip(COPY.allKinds, counts.total)}
            active={filters.imageKind === null}
            muted={counts.total === 0}
            onClick={() => setFilter({ imageKind: null })}
          />
          {PATIENT_FILE_KIND_ORDER.map((kind) => (
            <KindChip
              key={kind}
              label={COPY.chip(PATIENT_FILE_KIND_GROUP_LABELS[kind], counts.byKind[kind])}
              active={filters.imageKind === kind}
              muted={counts.byKind[kind] === 0}
              onClick={() => setFilter({ imageKind: kind })}
            />
          ))}
          {filters.imageTooth && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setFilter({ imageTooth: null })}
              aria-label={COPY.clearTooth(filters.imageTooth)}
              className="shrink-0 rounded-full"
            >
              {COPY.toothChip(filters.imageTooth)}
              <XIcon />
            </Button>
          )}
          <ToothFilter
            value={filters.imageTooth}
            onChange={(tooth) => setFilter({ imageTooth: tooth })}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={COPY.groupByLabel}
            className="bg-muted inline-flex rounded-lg p-0.5"
          >
            {IMAGING_GROUP_BY_VALUES.map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={filters.imageGroup === mode ? "outline" : "ghost"}
                aria-pressed={filters.imageGroup === mode}
                onClick={() => setFilter({ imageGroup: mode })}
                className={cn(filters.imageGroup !== mode && "text-muted-foreground")}
              >
                {IMAGING_GROUP_BY_LABELS[mode]}
              </Button>
            ))}
          </div>
          <Toggle
            variant="outline"
            pressed={selecting}
            onPressedChange={(pressed) => (pressed ? setSelecting(true) : stopSelecting())}
            disabled={data.items.length < IMAGING_COMPARE_MAX && !selecting}
            aria-label={selecting ? COPY.compareCancel : COPY.compare}
          >
            <ColumnsIcon />
            {COPY.compare}
          </Toggle>
          {canWrite && (
            <Button onClick={() => setUploading(true)}>
              <ImagePlusIcon />
              {COPY.addImages}
            </Button>
          )}
        </div>
      </div>

      {selecting && (
        <div className="bg-muted flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {selectedFiles.length === 0
              ? COPY.compareHint
              : COPY.compareSelected(selectedFiles.length)}
          </span>
          <Button size="sm" variant="ghost" onClick={stopSelecting}>
            {COPY.cancel}
          </Button>
          <Button
            size="sm"
            disabled={selectedFiles.length !== IMAGING_COMPARE_MAX}
            onClick={() => setComparing(true)}
          >
            <ColumnsIcon />
            {COPY.compare}
          </Button>
        </div>
      )}

      {patient.isArchived && (
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-sm">
          {COPY.archivedNotice}
        </p>
      )}

      {data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-6">
          {isFiltered && counts.total > 0 ? (
            <>
              <EmptyState
                title={COPY.emptyFilteredTitle}
                description={COPY.emptyFilteredDescription}
              />
              <Button
                variant="outline"
                onClick={() => setFilter({ imageKind: null, imageTooth: null })}
              >
                <RotateCcwIcon />
                {COPY.resetFilters}
              </Button>
            </>
          ) : (
            <EmptyState
              title={COPY.emptyTitle}
              description={COPY.emptyDescription}
            />
          )}
        </div>
      ) : (
        <div
          aria-busy={isFiltering}
          className={cn("transition-opacity", isFiltering && "opacity-60")}
        >
          <ImagingGroups
            groups={groups}
            collapsed={collapsed}
            onToggleGroup={toggleGroup}
            onActivate={activate}
            selectable={selecting}
            selectedIds={selectedFiles.map((file) => file.id)}
          />
        </div>
      )}

      {data.total > data.items.length && (
        <p className="text-muted-foreground text-sm">{COPY.truncated}</p>
      )}

      <ImageViewer
        files={ordered}
        fileId={viewedId}
        onFileChange={setViewedId}
        canWrite={canWrite}
        canRemove={canRemove}
      />

      {comparing && selectedFiles.length === IMAGING_COMPARE_MAX && (
        <CompareView
          files={[selectedFiles[0], selectedFiles[1]]}
          open
          onOpenChange={(open) => {
            if (!open) setComparing(false);
          }}
        />
      )}

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
  muted,
  onClick,
}: {
  label: string;
  active: boolean;
  /** Zero images of this kind: still offered, visibly empty. */
  muted: boolean;
  onClick: () => void;
}) => (
  <Button
    type="button"
    size="sm"
    variant={active ? "default" : "outline"}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full tabular-nums",
      muted && !active && "text-muted-foreground border-dashed",
    )}
  >
    {label}
  </Button>
);

const ImagingGallerySkeleton = () => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="bg-muted h-7 w-24 animate-pulse rounded-full" />
      ))}
    </div>
    <div className="bg-muted h-5 w-32 animate-pulse rounded" />
    <div className={IMAGING_GRID}>
      {Array.from({ length: 8 }, (_, index) => (
        <ImagingTileSkeleton key={index} />
      ))}
    </div>
  </div>
);

export default PatientImaging;
