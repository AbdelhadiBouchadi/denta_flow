"use client";

import { CheckIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  IMAGING_COPY as COPY,
  IMAGING_TILE_MAX_TEETH,
  PATIENT_FILE_KIND_LABELS,
  imagingFileUrl,
} from "../constants";
import { thumbnailSize } from "../files";
import type { ImagingFile, PatientFileKind } from "../types";
import ImagingKindBadge from "./imaging-kind-badge";
import ToothChips from "./tooth-chips";

interface ImagingTileProps {
  file: ImagingFile;
  /** A tap: opens the viewer, or toggles the pick in selection mode. */
  onActivate: () => void;
  /** «Comparer» mode: the tile is a checkbox, not a link to the viewer. */
  selectable?: boolean;
  selected?: boolean;
}

/**
 * One gallery tile: the THUMBNAIL only — the grid never loads an original
 * (decision 8). A plain `<img>` on the same-origin route, not `next/image`,
 * which would try to optimise a private authenticated URL (decision 7). Its
 * `width` / `height` are the thumbnail's computed size, so the browser
 * reserves the box before the bytes arrive. A missing or failed thumbnail
 * shows a neutral placeholder.
 *
 * prompts/32: up to three tooth chips («+N» beyond), and a selection mode —
 * `aria-pressed`, a ring and a check, tokens only.
 */
const ImagingTile = ({
  file,
  onActivate,
  selectable = false,
  selected = false,
}: ImagingTileProps) => {
  // The <img> failed to load — DOM state, not data.
  const [failed, setFailed] = useState(false);
  const kind = file.kind as PatientFileKind;
  const date = formatDate(file.takenAt);
  const thumb = thumbnailSize(file.width, file.height);
  const label = COPY.tileLabel(PATIENT_FILE_KIND_LABELS[kind], date);

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={selectable ? COPY.selectTile(label) : label}
      aria-pressed={selectable ? selected : undefined}
      data-selected={selected || undefined}
      className={cn(
        "group bg-muted focus-visible:ring-ring relative aspect-square w-full overflow-hidden rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "data-selected:ring-primary data-selected:ring-offset-background data-selected:ring-3 data-selected:ring-offset-2",
      )}
    >
      {file.hasThumbnail && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- decision 7
        <img
          src={imagingFileUrl(file.id, "thumb")}
          alt=""
          width={thumb.width}
          height={thumb.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]",
            selectable && !selected && "opacity-80",
          )}
        />
      ) : (
        <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-2 text-xs">
          <ImageOffIcon className="size-6" aria-hidden="true" />
          {COPY.noThumbnail}
        </span>
      )}

      {selectable && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-2 transition-colors",
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-background/80 border-background",
          )}
        >
          {selected && <CheckIcon className="size-4" />}
        </span>
      )}

      {file.teeth.length > 0 && (
        <ToothChips
          teeth={file.teeth}
          max={IMAGING_TILE_MAX_TEETH}
          className="absolute top-2 right-2 max-w-[70%] justify-end"
        />
      )}

      {/* The legend sits on a scrim so it reads over any image, light or dark. */}
      <span className="from-foreground/70 absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t to-transparent p-2 pt-6">
        <ImagingKindBadge kind={kind} className="max-w-[60%] truncate" />
        <span
          suppressHydrationWarning
          className="text-background text-xs font-medium tabular-nums"
        >
          {date}
        </span>
      </span>
    </button>
  );
};

export const ImagingTileSkeleton = () => (
  <Skeleton className="aspect-square w-full rounded-lg" />
);

export default ImagingTile;
