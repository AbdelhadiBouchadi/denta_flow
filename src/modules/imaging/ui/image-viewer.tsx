"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ContrastIcon,
  DownloadIcon,
  InfoIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCwIcon,
  ScanIcon,
  Trash2Icon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
// The viewer is a DEDICATED full-screen overlay, which prompts/31 allows
// instead of `ResponsiveDialog`: the phone drawer's swipe-to-close would
// fight the pan and pinch gestures, and the image needs the whole screen.
// The Dialog primitive still provides the focus trap, Escape and the body
// scroll lock.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  IMAGING_COPY as COPY,
  PATIENT_FILE_KIND_LABELS,
  imagingFileUrl,
} from "../constants";
import { formatFileSize, thumbnailSize } from "../files";
import { neighboursOf } from "../gallery";
import { useInvalidateImaging } from "../hooks/use-invalidate-imaging";
import type { ImagingFile, PatientFileKind } from "../types";
import {
  adjustmentFilter,
  AdjustmentsPopover,
  DEFAULT_LEVEL,
} from "./display-adjustments";
import { ImageMetadataForm } from "./image-metadata-form";
import ImagingKindBadge from "./imaging-kind-badge";
import ToothChips from "./tooth-chips";

interface ImageViewerProps {
  /** The grid's current filtered and grouped set, in grid order. */
  files: ImagingFile[];
  /** The open file's id — `null` closes the viewer. */
  fileId: string | null;
  onFileChange: (fileId: string | null) => void;
  canWrite: boolean;
  canRemove: boolean;
}

/** Keys the viewer answers — except while a field or slider has focus. */
const isEditingTarget = (target: EventTarget) =>
  target instanceof HTMLElement &&
  target.closest(
    "input, textarea, select, [role='slider'], [role='listbox'], [role='menu'], [contenteditable='true']",
  ) !== null;

/**
 * The original through `react-zoom-pan-pinch` (wheel and pinch zoom, drag to
 * pan, double-tap to zoom) with display-only adjustments, previous / next,
 * and a details panel (a bottom section on phones). The image is always the
 * same-origin route — the session is checked on every request — and never
 * `next/image` (decision 7).
 *
 * prompts/32: previous / next and the filmstrip walk `files` — the grid's
 * filtered set in its grouped order — so «next» is the tile to the right.
 */
const ImageViewer = ({
  files,
  fileId,
  onFileChange,
  canWrite,
  canRemove,
}: ImageViewerProps) => {
  const { index, previousId, nextId } = neighboursOf(
    files.map((f) => f.id),
    fileId,
  );
  // Removed, or re-filed out of the current filter: the viewer closes.
  const file = index === -1 ? null : files[index];

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditingTarget(event.target)) return;
    if (event.key === "ArrowLeft" && previousId) {
      event.preventDefault();
      onFileChange(previousId);
    } else if (event.key === "ArrowRight" && nextId) {
      event.preventDefault();
      onFileChange(nextId);
    }
  };

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onFileChange(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        className="bg-background top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        {file && (
          // Keyed by file: zoom, rotation and adjustments start fresh on
          // every image, and an open edit form never carries over.
          <ViewerPage
            key={file.id}
            file={file}
            index={index}
            total={files.length}
            onPrevious={previousId ? () => onFileChange(previousId) : null}
            onNext={nextId ? () => onFileChange(nextId) : null}
            onClose={() => onFileChange(null)}
            onRemoved={() => onFileChange(nextId ?? previousId)}
            canWrite={canWrite}
            canRemove={canRemove}
          />
        )}
        {/* Outside the keyed page: its thumbnails stay mounted (the file
            route answers `no-store`) while the page changes image. */}
        {file && files.length > 1 && (
          <Filmstrip files={files} currentId={file.id} onSelect={onFileChange} />
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ViewerPageProps {
  file: ImagingFile;
  index: number;
  total: number;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
  onRemoved: () => void;
  canWrite: boolean;
  canRemove: boolean;
}

const ViewerPage = ({
  file,
  index,
  total,
  onPrevious,
  onNext,
  onClose,
  onRemoved,
  canWrite,
  canRemove,
}: ViewerPageProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateImaging();
  const kind = file.kind as PatientFileKind;

  // Display-only adjustments (decision: never persisted, never applied to
  // the stored file) — local UI state, not URL state.
  const [brightness, setBrightness] = useState(DEFAULT_LEVEL);
  const [contrast, setContrast] = useState(DEFAULT_LEVEL);
  const [inverted, setInverted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription,
    "destructive",
  );

  const remove = useMutation(
    trpc.imaging.remove.mutationOptions({
      onSuccess: async () => {
        onRemoved();
        await invalidate();
        toast.success(COPY.removed);
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidate();
      },
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    remove.mutate({ id: file.id });
  };

  const resetAdjustments = () => {
    setBrightness(DEFAULT_LEVEL);
    setContrast(DEFAULT_LEVEL);
    setInverted(false);
    setRotation(0);
  };

  const title = `${PATIENT_FILE_KIND_LABELS[kind]} — ${formatDate(file.takenAt)}`;

  return (
    <>
      <RemoveConfirmation />
      <DialogTitle className="sr-only">{COPY.viewerTitle}</DialogTitle>
      <DialogDescription className="sr-only">{title}</DialogDescription>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <TransformWrapper
          minScale={0.5}
          maxScale={12}
          centerOnInit
          doubleClick={{ mode: "toggle", step: 1.5 }}
          wheel={{ step: 0.15 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Top bar */}
              <div className="flex items-center gap-2 border-b px-2 py-2 md:px-4">
                <ImagingKindBadge kind={kind} />
                <span
                  suppressHydrationWarning
                  className="min-w-0 truncate text-sm font-medium tabular-nums"
                >
                  {formatDate(file.takenAt)}
                </span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {COPY.position(index + 1, total)}
                </span>
                <Toggle
                  size="lg"
                  pressed={detailsOpen}
                  onPressedChange={setDetailsOpen}
                  aria-label={detailsOpen ? COPY.hideDetails : COPY.details}
                  className="md:hidden"
                >
                  <InfoIcon />
                </Toggle>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={onClose}
                  aria-label={COPY.close}
                >
                  <XIcon />
                </Button>
              </div>

              {/* Stage */}
              <div className="bg-muted relative min-h-0 flex-1 overflow-hidden">
                {!loaded && !failed && (
                  <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    {COPY.loadingImage}
                  </div>
                )}
                {failed && (
                  <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-4 text-center text-sm">
                    {COPY.imageFailed}
                  </div>
                )}
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%" }}
                  contentClass="flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- decision 7 */}
                  <img
                    src={imagingFileUrl(file.id)}
                    alt={title}
                    width={file.width}
                    height={file.height}
                    draggable={false}
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className="max-h-full max-w-full object-contain transition-[filter,transform] duration-150 select-none"
                    style={{
                      filter: adjustmentFilter(brightness, contrast, inverted),
                      transform: `rotate(${rotation}deg)`,
                    }}
                  />
                </TransformComponent>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-center gap-1 border-t px-2 py-2">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={!onPrevious}
                  onClick={() => onPrevious?.()}
                  aria-label={COPY.previous}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button variant="ghost" size="icon-lg" onClick={() => zoomOut()} aria-label={COPY.zoomOut}>
                  <ZoomOutIcon />
                </Button>
                <Button variant="ghost" size="icon-lg" onClick={() => zoomIn()} aria-label={COPY.zoomIn}>
                  <ZoomInIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => {
                    resetTransform();
                    resetAdjustments();
                  }}
                  aria-label={COPY.reset}
                >
                  <ScanIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => setRotation((value) => (value + 90) % 360)}
                  aria-label={COPY.rotate}
                >
                  <RotateCwIcon />
                </Button>
                <Toggle
                  size="lg"
                  pressed={inverted}
                  onPressedChange={setInverted}
                  aria-label={COPY.invert}
                >
                  <ContrastIcon />
                </Toggle>
                <AdjustmentsPopover
                  brightness={brightness}
                  contrast={contrast}
                  onBrightnessChange={setBrightness}
                  onContrastChange={setContrast}
                />
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={!onNext}
                  onClick={() => onNext?.()}
                  aria-label={COPY.next}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          )}
        </TransformWrapper>

        {/* Details: a side panel on desktop, a bottom section on phones. */}
        <aside
          data-open={detailsOpen || undefined}
          className="hidden max-h-[45dvh] shrink-0 flex-col gap-4 overflow-y-auto border-t p-4 data-open:flex md:flex md:max-h-none md:w-80 md:border-t-0 md:border-l"
        >
          {editing ? (
            <ImageMetadataForm file={file} onDone={() => setEditing(false)} />
          ) : (
            <>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{COPY.kind}</dt>
                <dd><ImagingKindBadge kind={kind} /></dd>
                <dt className="text-muted-foreground">{COPY.takenDate}</dt>
                <dd suppressHydrationWarning className="tabular-nums">{formatDate(file.takenAt)}</dd>
                <dt className="text-muted-foreground">{COPY.teeth}</dt>
                <dd>
                  {file.teeth.length > 0 ? (
                    <ToothChips teeth={file.teeth} className="[&>span]:bg-muted" />
                  ) : (
                    <span className="text-muted-foreground">{COPY.noTeeth}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">{COPY.uploadedBy}</dt>
                <dd>{file.uploaderName ?? COPY.unknownStaff}</dd>
                <dt className="text-muted-foreground">{COPY.addedOn}</dt>
                <dd suppressHydrationWarning className="tabular-nums">{formatDateTime(file.createdAt)}</dd>
                <dt className="text-muted-foreground">{COPY.dimensions}</dt>
                <dd className="tabular-nums">{COPY.dimensionsValue(file.width, file.height)}</dd>
                <dt className="text-muted-foreground">{COPY.size}</dt>
                <dd className="tabular-nums">{formatFileSize(file.sizeBytes)}</dd>
                <dt className="text-muted-foreground">{COPY.file}</dt>
                <dd className="break-all">{file.originalName}</dd>
              </dl>

              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{COPY.notes}</span>
                <p className="whitespace-pre-wrap">
                  {file.notes ?? <span className="text-muted-foreground">{COPY.noNotes}</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  nativeButton={false}
                  render={<a href={imagingFileUrl(file.id, "download")} download />}
                >
                  <DownloadIcon />
                  {COPY.download}
                </Button>
                {canWrite && (
                  <Button variant="outline" size="icon-lg" onClick={() => setEditing(true)} aria-label={COPY.edit}>
                    <PencilIcon />
                  </Button>
                )}
                {canRemove && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          disabled={remove.isPending}
                          aria-label={COPY.moreActions}
                        />
                      }
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem variant="destructive" onClick={() => void handleRemove()}>
                        <Trash2Icon />
                        {COPY.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
};

interface FilmstripProps {
  files: ImagingFile[];
  currentId: string;
  onSelect: (fileId: string) => void;
}

/**
 * The set's thumbnails in one row that scrolls sideways INSIDE its own
 * container (never the page). Thumbnails only — never an original — and
 * lazy-loaded; the current one is scrolled into view on every change.
 */
const Filmstrip = ({ files, currentId, onSelect }: FilmstripProps) => {
  const currentRef = useRef<HTMLButtonElement>(null);

  // DOM sync, not data: keep the current thumbnail visible.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [currentId]);

  return (
    <nav aria-label={COPY.filmstrip} className="min-w-0 shrink-0 border-t">
      <ol className="flex gap-1.5 overflow-x-auto overscroll-x-contain px-2 py-2 scrollbar-thin">
        {files.map((file, index) => {
          const current = file.id === currentId;
          const kind = file.kind as PatientFileKind;
          const thumb = thumbnailSize(file.width, file.height);
          return (
            <li key={file.id} className="shrink-0">
              <button
                ref={current ? currentRef : undefined}
                type="button"
                onClick={() => onSelect(file.id)}
                aria-current={current || undefined}
                aria-label={COPY.filmstripItem(
                  COPY.tileLabel(PATIENT_FILE_KIND_LABELS[kind], formatDate(file.takenAt)),
                  index + 1,
                  files.length,
                )}
                className={cn(
                  "bg-muted focus-visible:ring-ring block size-14 overflow-hidden rounded-md border outline-none focus-visible:ring-2 md:size-16",
                  current
                    ? "ring-primary ring-offset-background ring-2 ring-offset-1"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                {file.hasThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element -- decision 7
                  <img
                    src={imagingFileUrl(file.id, "thumb")}
                    alt=""
                    width={thumb.width}
                    height={thumb.height}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-cover"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default ImageViewer;
