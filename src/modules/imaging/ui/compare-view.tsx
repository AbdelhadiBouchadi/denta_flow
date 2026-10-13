"use client";

import {
  ContrastIcon,
  Loader2Icon,
  ScanIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
// A DEDICATED full-screen overlay, like the viewer (prompts/31 allowed it in
// place of `ResponsiveDialog`): the phone drawer's swipe-to-close would fight
// the pan and pinch gestures, and two images need the whole screen. The
// Dialog primitive still provides the focus trap, Escape and the scroll lock.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  IMAGING_COPY as COPY,
  PATIENT_FILE_KIND_LABELS,
  imagingFileUrl,
} from "../constants";
import {
  createTransformSync,
  type PaneView,
  type TransformState,
} from "../compare-sync";
import type { ImagingFile, PatientFileKind } from "../types";
import {
  adjustmentFilter,
  AdjustmentsPopover,
  DEFAULT_LEVEL,
} from "./display-adjustments";
import ImagingKindBadge from "./imaging-kind-badge";
import ToothChips from "./tooth-chips";

interface CompareViewProps {
  files: [ImagingFile, ImagingFile];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaneRef = RefObject<ReactZoomPanPinchRef | null>;

/** A pane's live transform and frame, read from the library instance. */
const readPane = (ref: PaneRef, file: ImagingFile): PaneView | null => {
  const instance = ref.current?.instance;
  const wrapper = instance?.wrapperComponent;
  if (!instance || !wrapper) return null;
  const { scale, positionX, positionY } = instance.transformState;
  return {
    state: { scale, positionX, positionY },
    frame: {
      wrapperWidth: wrapper.offsetWidth,
      wrapperHeight: wrapper.offsetHeight,
      naturalWidth: file.width,
      naturalHeight: file.height,
    },
  };
};

/**
 * «Comparer» (prompts/32, decision 5): two images side by side (stacked
 * below `md`), each with its own zoom and pan, and ONE set of display
 * adjustments applied to both. «Synchroniser le zoom» (on by default)
 * mirrors the zoom and the RELATIVE pan position from the pane being moved
 * onto the other — see `compare-sync.ts` for the maths and the
 * feedback-loop guard.
 */
const CompareView = ({ files, open, onOpenChange }: CompareViewProps) => {
  const syncSwitchId = useId();
  const [synced, setSynced] = useState(true);
  const [brightness, setBrightness] = useState(DEFAULT_LEVEL);
  const [contrast, setContrast] = useState(DEFAULT_LEVEL);
  const [inverted, setInverted] = useState(false);

  const paneRefs = [
    useRef<ReactZoomPanPinchRef>(null),
    useRef<ReactZoomPanPinchRef>(null),
  ] as const;
  // One guard for the pair, for the dialog's lifetime.
  const [sync] = useState(createTransformSync);

  /** Mirror pane `from` onto the other one. */
  const follow = (from: 0 | 1, state?: TransformState) => {
    const to = from === 0 ? 1 : 0;
    const source = readPane(paneRefs[from], files[from]);
    const target = readPane(paneRefs[to], files[to]);
    const controls = paneRefs[to].current;
    if (!source || !target || !controls) return;
    sync(
      state ? { ...source, state } : source,
      target,
      (next) => controls.setTransform(next.positionX, next.positionY, next.scale, 0),
    );
  };

  const onTransformed = (from: 0 | 1) => (_: unknown, state: TransformState) => {
    if (synced) follow(from, state);
  };

  const filter = adjustmentFilter(brightness, contrast, inverted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-background top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <DialogTitle className="sr-only">{COPY.compareTitle}</DialogTitle>
        <DialogDescription className="sr-only">{COPY.compareDescription}</DialogDescription>

        {/* Shared controls */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-2 py-2 md:px-4">
          <span className="min-w-0 truncate text-sm font-medium">{COPY.compareTitle}</span>
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id={syncSwitchId}
              checked={synced}
              onCheckedChange={(checked) => {
                setSynced(checked);
                // Turning sync on aligns the right pane on the left one.
                if (checked) follow(0);
              }}
            />
            <Label htmlFor={syncSwitchId} className="text-sm font-normal">
              {COPY.syncZoom}
            </Label>
          </div>
          <div className="flex items-center gap-1">
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
              onClick={() => onOpenChange(false)}
              aria-label={COPY.close}
            >
              <XIcon />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
          {files.map((file, index) => (
            <ComparePane
              key={file.id}
              file={file}
              paneRef={paneRefs[index]}
              filter={filter}
              onTransformed={onTransformed(index as 0 | 1)}
              className={index === 1 ? "border-t md:border-t-0 md:border-l" : undefined}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ComparePaneProps {
  file: ImagingFile;
  paneRef: PaneRef;
  filter: string;
  onTransformed: (ref: ReactZoomPanPinchRef, state: TransformState) => void;
  className?: string;
}

const ComparePane = ({
  file,
  paneRef,
  filter,
  onTransformed,
  className,
}: ComparePaneProps) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const kind = file.kind as PatientFileKind;
  const title = `${PATIENT_FILE_KIND_LABELS[kind]} — ${formatDate(file.takenAt)}`;

  return (
    <TransformWrapper
      ref={paneRef}
      minScale={0.5}
      maxScale={12}
      centerOnInit
      doubleClick={{ mode: "toggle", step: 1.5 }}
      wheel={{ step: 0.15 }}
      onTransformed={onTransformed}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <section aria-label={title} className={cn("flex min-h-0 min-w-0 flex-col", className)}>
          <div className="flex min-w-0 flex-wrap items-center gap-2 px-2 py-1.5 md:px-3">
            <ImagingKindBadge kind={kind} />
            <span suppressHydrationWarning className="text-sm font-medium tabular-nums">
              {formatDate(file.takenAt)}
            </span>
            <ToothChips teeth={file.teeth} className="min-w-0" />
            <div className="ml-auto flex items-center">
              <Button variant="ghost" size="icon" onClick={() => zoomOut()} aria-label={COPY.zoomOut}>
                <ZoomOutIcon />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => zoomIn()} aria-label={COPY.zoomIn}>
                <ZoomInIcon />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => resetTransform()} aria-label={COPY.reset}>
                <ScanIcon />
              </Button>
            </div>
          </div>
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
              {/* Same-origin route, never `next/image` (prompts/31, decision 7).
                  `max-w/h-full` + `object-contain`, never upscaled — the frame
                  `compare-sync.ts` assumes. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- decision 7 */}
              <img
                src={imagingFileUrl(file.id)}
                alt={title}
                width={file.width}
                height={file.height}
                draggable={false}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className="max-h-full max-w-full object-contain transition-[filter] duration-150 select-none"
                style={{ filter }}
              />
            </TransformComponent>
          </div>
        </section>
      )}
    </TransformWrapper>
  );
};

export default CompareView;
