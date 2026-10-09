"use client";

import * as React from "react";
import Image from "next/image";
import { ImageUpIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { ErrorCode, useDropzone, type FileRejection } from "react-dropzone";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ASSET_FILE_EXTENSIONS,
  ASSET_MAX_BYTES,
  ASSET_REJECTION_MESSAGES,
  IMAGE_DROPZONE_COPY,
} from "@/constants";
import { formatFileSize } from "@/lib/assets";
import { cn } from "@/lib/utils";

/**
 * What the user has staged against the saved image. A tri-state rather than
 * `File | null`: `null` could not tell "nothing staged, keep the saved image"
 * from "remove the saved image".
 */
export type ImageChange =
  { kind: "unchanged" } | { kind: "replace"; file: File } | { kind: "remove" };

interface ImageDropzoneProps {
  /** The saved remote URL, or `null` when none is saved. */
  value: string | null;
  change: ImageChange;
  onChange: (change: ImageChange) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  /**
   * The box's shape from `sm` up, e.g. `sm:aspect-square` for a logo. Below
   * `sm` the box stays a compact strip rather than a full-width square.
   */
  aspectClassName?: string;
  className?: string;
  /** Lands on the file input, so a `FieldLabel htmlFor` opens the picker. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface StagedPreview {
  file: File;
  url: string;
}

const ACCEPT = Object.fromEntries(
  Object.entries(ASSET_FILE_EXTENSIONS).map(([mime, extensions]) => [
    mime,
    [...extensions],
  ]),
);

const rejectionMessage = (rejections: readonly FileRejection[]) => {
  const codes = rejections.flatMap(({ errors }) => errors.map((e) => e.code));
  if (codes.includes(ErrorCode.TooManyFiles)) {
    return ASSET_REJECTION_MESSAGES.tooMany;
  }
  if (codes.includes(ErrorCode.FileTooLarge)) {
    return ASSET_REJECTION_MESSAGES.tooLarge;
  }
  return ASSET_REJECTION_MESSAGES.unsupportedType;
};

/**
 * Stages one image; it never uploads and never talks to tRPC. The parent
 * uploads the staged file on «Enregistrer», then resets `change` to
 * `unchanged` and passes the new remote `value`.
 *
 * Object URLs are created in the event handler that stages the file — never
 * in render or `useMemo`, where StrictMode's double invoke would revoke the
 * URL the first render still shows — and revoked on replace, on remove, when
 * the parent drops the staged file, and on unmount.
 */
const ImageDropzone = ({
  value,
  change,
  onChange,
  label,
  hint,
  disabled = false,
  aspectClassName = "sm:aspect-square",
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: ImageDropzoneProps) => {
  const labelId = React.useId();
  const errorId = React.useId();

  const [staged, setStaged] = React.useState<StagedPreview | null>(null);
  const [rejection, setRejection] = React.useState<string | null>(null);
  // The URL to revoke. Written only from handlers and effects, never in render.
  const stagedRef = React.useRef<StagedPreview | null>(null);

  const revokeStaged = React.useCallback(() => {
    if (stagedRef.current) URL.revokeObjectURL(stagedRef.current.url);
    stagedRef.current = null;
  }, []);

  // The parent dropped the staged file (saved, or form reset): release its
  // URL. The preview already stopped showing it — see `previewUrl` below.
  React.useEffect(() => {
    const current = stagedRef.current;
    if (!current) return;
    if (change.kind !== "replace" || change.file !== current.file) {
      revokeStaged();
    }
  }, [change, revokeStaged]);

  React.useEffect(() => revokeStaged, [revokeStaged]);

  const handleDrop = (
    accepted: File[],
    rejections: readonly FileRejection[],
  ) => {
    if (rejections.length > 0 || accepted.length !== 1) {
      setRejection(rejectionMessage(rejections));
      return;
    }
    const [file] = accepted;
    revokeStaged();
    const next = { file, url: URL.createObjectURL(file) };
    stagedRef.current = next;
    setStaged(next);
    setRejection(null);
    onChange({ kind: "replace", file });
  };

  const handleRemove = () => {
    revokeStaged();
    setStaged(null);
    setRejection(null);
    // Nothing saved ⇒ dropping the staged file is all "remove" can mean.
    onChange(value ? { kind: "remove" } : { kind: "unchanged" });
  };

  const stagedFile = change.kind === "replace" ? change.file : null;
  const previewUrl =
    stagedFile && staged?.file === stagedFile ? staged.url : null;
  const displayUrl = previewUrl ?? (change.kind === "remove" ? null : value);
  const hasImage = displayUrl !== null;

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    maxSize: ASSET_MAX_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled,
    // Once an image shows, the visible buttons own click and keyboard; the
    // box stays a drop target.
    noClick: hasImage,
    noKeyboard: hasImage,
    onDrop: handleDrop,
  });

  const isInvalid = ariaInvalid === true || rejection !== null;
  const describedBy =
    [ariaDescribedBy, rejection ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-0.5">
        <p id={labelId} className="text-ui text-foreground font-medium">
          {label}
        </p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>

      <div
        {...getRootProps({
          role: hasImage ? undefined : "button",
          "aria-labelledby": labelId,
          "aria-invalid": isInvalid || undefined,
          "aria-describedby": describedBy,
          "aria-disabled": disabled || undefined,
        })}
        className={cn(
          // `min-h-36` keeps the box compact on a phone, where the shape in
          // `aspectClassName` is expected to apply from `sm` only.
          "border-border bg-card relative flex min-h-36 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          !hasImage && !disabled && "hover:bg-muted/50 cursor-pointer",
          isDragActive && "border-primary bg-accent",
          isInvalid && "border-destructive",
          disabled && "cursor-not-allowed opacity-50",
          aspectClassName,
        )}
      >
        {/* Out of the flex row: react-dropzone sizes it `width: 0`, but
            WebKit (every iOS browser) still floors a flex item at a file
            control's intrinsic width, and that minimum widened the box — and
            the `auto` grid track holding it — past a phone's viewport. */}
        <input {...getInputProps({ id, className: "sr-only" })} />

        {hasImage ? (
          <div className="bg-muted absolute inset-0">
            <Image
              src={displayUrl}
              alt={label}
              fill
              unoptimized
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-contain p-3"
            />
            {isDragActive && (
              <div className="bg-accent/90 text-accent-foreground absolute inset-0 flex items-center justify-center">
                <span className="text-ui font-medium">
                  {IMAGE_DROPZONE_COPY.dragActive}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-2 p-4 text-center sm:p-6">
            <ImageUpIcon
              className={cn(
                "size-8 shrink-0",
                isDragActive ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            {isDragActive ? (
              <p className="text-ui text-accent-foreground font-medium">
                {IMAGE_DROPZONE_COPY.dragActive}
              </p>
            ) : (
              // A touch screen cannot drag a file in: a media query, not a
              // JS check, picks the wording, so server and client agree.
              <p className="text-ui text-foreground-secondary">
                <span className="pointer-coarse:hidden">
                  {IMAGE_DROPZONE_COPY.dropPrompt}{" "}
                  <span className="text-primary font-medium underline-offset-4 hover:underline">
                    {IMAGE_DROPZONE_COPY.browse}
                  </span>
                </span>
                <span className="text-primary pointer-coarse:inline hidden font-medium">
                  {IMAGE_DROPZONE_COPY.tapPrompt}
                </span>
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {IMAGE_DROPZONE_COPY.formats}
            </p>
          </div>
        )}
      </div>

      {(change.kind === "replace" ||
        (change.kind === "remove" && value !== null)) && (
        <div className="flex min-w-0 items-center gap-2">
          <Badge className="bg-warning-subtle text-warning-strong shrink-0">
            {IMAGE_DROPZONE_COPY.unsaved}
          </Badge>
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            {change.kind === "replace" ? (
              <>
                <span className="text-foreground-secondary">
                  {change.file.name}
                </span>{" "}
                <span className="tabular-nums">
                  · {formatFileSize(change.file.size)}
                </span>
              </>
            ) : (
              IMAGE_DROPZONE_COPY.removalPending
            )}
          </p>
        </div>
      )}

      {hasImage && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={open}
          >
            <RefreshCwIcon aria-hidden="true" />
            {IMAGE_DROPZONE_COPY.replace}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled}
            onClick={handleRemove}
          >
            <Trash2Icon aria-hidden="true" />
            {IMAGE_DROPZONE_COPY.remove}
          </Button>
        </div>
      )}

      {rejection && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {rejection}
        </p>
      )}
    </div>
  );
};

export default ImageDropzone;
