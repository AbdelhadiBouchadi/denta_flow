"use client";

import { ImageOffIcon } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import {
  IMAGING_COPY as COPY,
  PATIENT_FILE_KIND_LABELS,
  imagingFileUrl,
} from "../constants";
import { thumbnailSize } from "../files";
import type { ImagingFile, PatientFileKind } from "../types";
import ImagingKindBadge from "./imaging-kind-badge";

interface ImagingTileProps {
  file: ImagingFile;
  onOpen: () => void;
}

/**
 * One gallery tile: the THUMBNAIL only — the grid never loads an original
 * (decision 8). A plain `<img>` on the same-origin route, not `next/image`,
 * which would try to optimise a private authenticated URL (decision 7). Its
 * `width` / `height` are the thumbnail's computed size, so the browser
 * reserves the box before the bytes arrive. A missing or failed thumbnail
 * shows a neutral placeholder.
 */
const ImagingTile = ({ file, onOpen }: ImagingTileProps) => {
  // The <img> failed to load — DOM state, not data.
  const [failed, setFailed] = useState(false);
  const kind = file.kind as PatientFileKind;
  const date = formatDate(file.takenAt);
  const thumb = thumbnailSize(file.width, file.height);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={COPY.tileLabel(PATIENT_FILE_KIND_LABELS[kind], date)}
      className="group bg-muted focus-visible:ring-ring relative aspect-square w-full overflow-hidden rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-2 text-xs">
          <ImageOffIcon className="size-6" aria-hidden="true" />
          {COPY.noThumbnail}
        </span>
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
