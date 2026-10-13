"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  ImagePlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { getErrorMessage } from "@/lib/errors";
import { toClinicDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import {
  IMAGE_ACCEPT,
  IMAGING_COPY as COPY,
  IMAGING_SERVER_ERRORS as E,
  IMAGING_UPLOAD_ROUTE,
  IMAGING_VALIDATION_MESSAGES as M,
  MAX_FILES_PER_BATCH,
  THUMBNAIL_CONTENT_TYPE,
  UPLOAD_CONCURRENCY,
} from "../constants";
import {
  buildUploadPathname,
  formatFileSize,
  imageDimensionsDenial,
  imageFileDenial,
} from "../files";
import { useInvalidateImaging } from "../hooks/use-invalidate-imaging";
import {
  imagingUploadFormSchema,
  imagingUploadItemSchema,
  type ImagingUploadFormValues,
  type ImagingUploadItem,
} from "../schemas";
import { PatientFileKind, type ImageContentType } from "../types";
import { makeThumbnail, readImageDimensions } from "./image-processing";
import { KindSelect, TakenDatePicker } from "./metadata-fields";
import { TeethField } from "./teeth-field";

type UploadStatus = "queued" | "uploading" | "done" | "error";

/** What a row renders. The `File` itself lives in a ref, not in state. */
interface UploadEntry {
  name: string;
  sizeBytes: number;
  previewUrl: string;
  width: number;
  height: number;
  status: UploadStatus;
  progress: number;
  error: string | null;
}

interface RejectedFile {
  key: string;
  name: string;
  error: string;
}

interface UploadImagesDialogProps {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A tRPC error carries `data`; anything else is the store or the network. */
const uploadErrorMessage = (error: unknown) =>
  typeof error === "object" && error !== null && "data" in error
    ? getErrorMessage(error)
    : E.uploadFailed;

/**
 * «Ajouter des images» (prompts/31, decisions 4, 5 and 8). Each picked file
 * is checked in the browser with the same validator the server runs, gets a
 * metadata row (kind, date, note), then on «Envoyer»:
 *
 * 1. its thumbnail is drawn on a canvas and sent to the private store
 *    (a failure only means «no thumbnail»);
 * 2. the original goes, byte for byte, straight to the store through a
 *    token signed by `/api/files/upload` — our server never sees the bytes;
 * 3. `imaging.register` checks the blob with `head()` and records the row.
 *
 * A rejected or failed file never blocks the others; a failed one offers
 * «Réessayer». Closing or «Annuler» aborts every upload in flight. Mounted
 * while open only, so each opening starts empty.
 */
const UploadImagesDialog = ({
  patientId,
  open,
  onOpenChange,
}: UploadImagesDialogProps) => {
  const trpc = useTRPC();
  const isMobile = useIsMobile();
  const invalidate = useInvalidateImaging();
  const register = useMutation(trpc.imaging.register.mutationOptions());

  const form = useForm<
    ImagingUploadFormValues,
    unknown,
    z.output<typeof imagingUploadFormSchema>
  >({
    resolver: zodResolver(imagingUploadFormSchema),
    defaultValues: { items: [] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "fieldId",
  });

  const [entries, setEntries] = useState<Record<string, UploadEntry>>({});
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const sources = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const previewUrls = useRef(new Set<string>());
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Object URLs are a browser resource: released with the dialog.
  useEffect(() => {
    const urls = previewUrls.current;
    const inFlight = controllers.current;
    return () => {
      inFlight.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const patchEntry = (key: string, patch: Partial<UploadEntry>) =>
    setEntries((previous) =>
      previous[key]
        ? { ...previous, [key]: { ...previous[key], ...patch } }
        : previous,
    );

  const addFiles = async (list: FileList | null, fromCamera: boolean) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const room = MAX_FILES_PER_BATCH - form.getValues("items").length;
    if (incoming.length > room) toast.error(COPY.tooMany);

    for (const file of incoming.slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID();
      const reject = (error: string) =>
        setRejected((previous) => [...previous, { key, name: file.name, error }]);

      const typeDenial = imageFileDenial(file);
      if (typeDenial) {
        reject(typeDenial);
        continue;
      }
      const size = await readImageDimensions(file);
      if (!size) {
        reject(M.unreadable);
        continue;
      }
      const sizeDenial = imageDimensionsDenial(size.width, size.height);
      if (sizeDenial) {
        reject(sizeDenial);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      sources.current.set(key, file);
      setEntries((previous) => ({
        ...previous,
        [key]: {
          name: file.name,
          sizeBytes: file.size,
          previewUrl,
          width: size.width,
          height: size.height,
          status: "queued",
          progress: 0,
          error: null,
        },
      }));
      append({
        key,
        kind: fromCamera ? PatientFileKind.Photo : PatientFileKind.Other,
        takenDate: toClinicDate(new Date()),
        notes: "",
        teeth: [],
      });
    }
  };

  const removeRow = (index: number, key: string) => {
    const entry = entries[key];
    if (entry) {
      URL.revokeObjectURL(entry.previewUrl);
      previewUrls.current.delete(entry.previewUrl);
    }
    sources.current.delete(key);
    remove(index);
    setEntries((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  /** One file, start to finish. `true` once its row is recorded. */
  const uploadOne = async (item: ImagingUploadItem) => {
    const file = sources.current.get(item.key);
    const entry = entries[item.key];
    if (!file || !entry) return false;

    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    patchEntry(item.key, { status: "uploading", progress: 0, error: null });

    const uuid = crypto.randomUUID();
    const contentType = file.type as ImageContentType;
    const options = (isThumbnail: boolean) => ({
      access: "private" as const,
      handleUploadUrl: IMAGING_UPLOAD_ROUTE,
      clientPayload: JSON.stringify({ patientId, kind: item.kind, isThumbnail }),
      abortSignal: controller.signal,
    });

    try {
      let thumbnailPathname: string | null = null;
      const thumbnail = await makeThumbnail(file);
      if (thumbnail) {
        try {
          const stored = await upload(
            buildUploadPathname({ patientId, uuid, contentType, isThumbnail: true }),
            thumbnail,
            { ...options(true), contentType: THUMBNAIL_CONTENT_TYPE },
          );
          thumbnailPathname = stored.pathname;
        } catch (error) {
          // A missing thumbnail never fails the upload — unless cancelled.
          if (controller.signal.aborted) throw error;
        }
      }

      const original = await upload(
        buildUploadPathname({ patientId, uuid, contentType, isThumbnail: false }),
        file,
        {
          ...options(false),
          contentType,
          onUploadProgress: ({ percentage }) =>
            patchEntry(item.key, { progress: percentage }),
        },
      );

      await register.mutateAsync({
        patientId,
        kind: item.kind,
        takenDate: item.takenDate,
        notes: item.notes,
        teeth: item.teeth,
        original: {
          pathname: original.pathname,
          name: file.name.slice(0, 255) || "image",
          width: entry.width,
          height: entry.height,
          sizeBytes: file.size,
          contentType,
        },
        thumbnail: thumbnailPathname ? { pathname: thumbnailPathname } : null,
      });

      patchEntry(item.key, { status: "done", progress: 100 });
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        patchEntry(item.key, {
          status: "error",
          error: uploadErrorMessage(error),
        });
      }
      return false;
    } finally {
      controllers.current.delete(item.key);
    }
  };

  /** A small worker pool: UPLOAD_CONCURRENCY files at a time. */
  const uploadAll = async (items: ImagingUploadItem[]) => {
    const queue = [...items];
    let succeeded = 0;
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        if (await uploadOne(item)) succeeded += 1;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker),
    );
    return succeeded;
  };

  const submit = async (values: z.output<typeof imagingUploadFormSchema>) => {
    const pending = values.items.filter(
      (item) => entries[item.key]?.status !== "done",
    );
    if (pending.length === 0) return;

    setIsSending(true);
    const succeeded = await uploadAll(pending);
    setIsSending(false);
    if (succeeded === 0) return;

    await invalidate();
    toast.success(COPY.uploaded(succeeded));
    if (succeeded === pending.length) onOpenChange(false);
  };

  const retry = async (index: number) => {
    if (!(await form.trigger(`items.${index}`))) return;
    const item = imagingUploadItemSchema.parse(form.getValues(`items.${index}`));
    setIsSending(true);
    const ok = await uploadOne(item);
    setIsSending(false);
    if (!ok) return;
    await invalidate();
    toast.success(COPY.uploaded(1));
  };

  const cancel = () => {
    controllers.current.forEach((controller) => controller.abort());
    onOpenChange(false);
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isSending) void addFiles(event.dataTransfer.files, false);
  };

  const remaining = fields.filter(
    (field) => entries[field.key]?.status !== "done",
  ).length;
  const isFull = fields.length >= MAX_FILES_PER_BATCH;

  return (
    <ResponsiveDialog
      title={COPY.uploadTitle}
      description={COPY.uploadDescription}
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : cancel())}
    >
      <form
        // Built in the handler, not during render: `submit` reads the
        // dialog's refs (the picked files, the abort controllers).
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
        noValidate
        className="@container flex min-h-0 flex-col gap-4"
      >
        {/* The list scrolls INSIDE the dialog, bounded by the viewport so the
            footer stays visible with ten files on a 1366×768 or 1280×720
            screen (prompts/32, decision 8). The budgets are the chrome around
            it: the dialog's header, padding and footer row on desktop; the
            drawer's `100dvh − 6rem` cap, handle, header and stacked buttons
            on a phone. */}
        <div className="flex max-h-[max(10rem,calc(100dvh-21rem))] min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-1 md:max-h-[max(12rem,min(65vh,calc(100dvh-14rem)))]">
          <input
            ref={pickerRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              void addFiles(event.currentTarget.files, false);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              void addFiles(event.currentTarget.files, true);
              event.currentTarget.value = "";
            }}
          />

          {/* The drop zone IS the picker button: keyboard and screen-reader
              users get the same control as a mouse dragging files in. */}
          <button
            type="button"
            disabled={isSending || isFull}
            onClick={() => pickerRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            data-dragging={isDragging || undefined}
            className="border-border hover:border-primary hover:bg-accent/50 data-dragging:border-primary data-dragging:bg-accent focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <ImagePlusIcon className="text-primary size-7" aria-hidden="true" />
            <span className="text-sm font-medium">{COPY.dropZone}</span>
            <span className="text-muted-foreground text-xs">
              {COPY.dropZoneHint}
            </span>
          </button>

          {isMobile && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSending || isFull}
              onClick={() => cameraRef.current?.click()}
            >
              <CameraIcon />
              {COPY.takePhoto}
            </Button>
          )}

          {rejected.length > 0 && (
            <ul className="flex flex-col gap-2">
              {rejected.map((file) => (
                <li
                  key={file.key}
                  className="bg-danger-subtle text-danger-strong flex items-start gap-2 rounded-md px-3 py-2 text-xs"
                >
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{file.name}</span>
                    {file.error}
                  </span>
                  <button
                    type="button"
                    aria-label={COPY.removeFile}
                    onClick={() =>
                      setRejected((previous) =>
                        previous.filter((item) => item.key !== file.key),
                      )
                    }
                    className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
                  >
                    <XIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fields.length > 0 && (
            <ul className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const entry = entries[field.key];
                if (!entry) return null;
                const locked = entry.status === "uploading" || entry.status === "done";
                const id = (name: string) => `upload-${field.key}-${name}`;
                return (
                  <li key={field.fieldId} className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      {/* A local object URL of the picked file — never uploaded from here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                      <img
                        src={entry.previewUrl}
                        alt=""
                        width={64}
                        height={64}
                        className="bg-muted size-16 shrink-0 rounded-md object-cover"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-sm font-medium">{entry.name}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatFileSize(entry.sizeBytes)} ·{" "}
                          {COPY.dimensionsValue(entry.width, entry.height)}
                        </span>
                        <UploadStatusLine entry={entry} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={COPY.removeFile}
                        disabled={locked}
                        onClick={() => removeRow(index, field.key)}
                      >
                        <XIcon />
                      </Button>
                    </div>

                    <div className="grid gap-3 @md:grid-cols-2 [&>*]:min-w-0">
                      <Controller
                        control={form.control}
                        name={`items.${index}.kind`}
                        render={({ field: input, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={id("kind")}>{COPY.kind}</FieldLabel>
                            <KindSelect
                              id={id("kind")}
                              value={input.value}
                              onChange={input.onChange}
                              disabled={locked}
                              invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`items.${index}.takenDate`}
                        render={({ field: input, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={id("date")}>{COPY.takenDate}</FieldLabel>
                            <TakenDatePicker
                              id={id("date")}
                              value={input.value}
                              onChange={input.onChange}
                              disabled={locked}
                              invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`items.${index}.teeth`}
                        render={({ field: input, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={id("teeth")}>{COPY.teeth}</FieldLabel>
                            <TeethField
                              id={id("teeth")}
                              value={input.value ?? []}
                              onChange={input.onChange}
                              disabled={locked}
                              invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`items.${index}.notes`}
                        render={({ field: input, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={id("notes")}>{COPY.notes}</FieldLabel>
                            <Input
                              {...input}
                              id={id("notes")}
                              value={input.value ?? ""}
                              autoComplete="off"
                              disabled={locked}
                              aria-invalid={fieldState.invalid}
                              placeholder={COPY.notesPlaceholder}
                              className="h-9"
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                    </div>

                    {entry.status === "error" && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-danger-strong flex items-start gap-1.5 text-xs">
                          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {entry.error}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSending}
                          onClick={() => void retry(index)}
                        >
                          <RotateCcwIcon />
                          {COPY.retry}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {fields.length > 0 && (
            <p className="text-muted-foreground text-xs">{COPY.exifNotice}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 @md:flex-row @md:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={cancel}
            className="w-full @md:w-auto"
          >
            {remaining === 0 && fields.length > 0 ? COPY.close : COPY.cancel}
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSending || remaining === 0}
            className="w-full @md:w-auto"
          >
            {isSending && <Spinner aria-label={COPY.sending} />}
            {isSending ? COPY.sending : COPY.send(Math.max(remaining, 1))}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
};

const UploadStatusLine = ({ entry }: { entry: UploadEntry }) => {
  if (entry.status === "uploading") {
    return (
      <Progress
        value={entry.progress}
        aria-label={COPY.statusUploading}
        className="mt-1"
      />
    );
  }
  if (entry.status === "done") {
    return (
      <span className="text-success-strong flex items-center gap-1 text-xs font-medium">
        <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
        {COPY.statusDone}
      </span>
    );
  }
  if (entry.status === "queued") {
    return <span className="text-muted-foreground text-xs">{COPY.statusQueued}</span>;
  }
  return null;
};

export default UploadImagesDialog;
