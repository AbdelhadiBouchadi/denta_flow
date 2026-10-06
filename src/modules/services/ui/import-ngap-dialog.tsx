"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { InfoIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import StatusBadge from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  importButtonLabel,
  importResultMessage,
  NGAP_COPY,
  NGAP_SEARCH_MAX_LIMIT,
  ngapTruncatedMessage,
  SERVICE_COPY,
} from "../constants";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useInvalidateServices } from "../hooks/use-invalidate-services";
import { NgapReference } from "./ngap-reference";

interface ImportNgapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every modal goes through ResponsiveDialog (06-ui.md §7). */
const ImportNgapDialog = ({ open, onOpenChange }: ImportNgapDialogProps) => (
  <ResponsiveDialog
    title={NGAP_COPY.importTitle}
    description={NGAP_COPY.importDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* Mounted only while open: each opening starts with a clean selection. */}
    {open && <ImportNgapPanel onDone={() => onOpenChange(false)} />}
  </ResponsiveDialog>
);

const ImportNgapPanel = ({ onDone }: { onDone: () => void }) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateServices();
  const [chapter, setChapter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Kept across filter changes: pick in Chirurgie, then in Prothèse, import once.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const debouncedSearch = useDebouncedValue(search.trim());

  // Opened on demand, never rendered by the page — so it is not prefetched
  // and reads with `useQuery`, like the patients header's option lists.
  const { data, isPending, isError, isFetching } = useQuery({
    ...trpc.services.searchNgap.queryOptions({
      query: debouncedSearch || null,
      chapter,
      limit: NGAP_SEARCH_MAX_LIMIT,
    }),
    placeholderData: keepPreviousData,
  });

  const importNgap = useMutation(
    trpc.services.importNgap.mutationOptions({
      onSuccess: async (result) => {
        await invalidateAll();
        toast.success(importResultMessage(result));
        onDone();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const items = data?.items ?? [];
  const selectable = items.filter((act) => !act.alreadyInCatalogue);
  const selectedInView = selectable.filter((act) => selected.has(act.code));
  const allSelected =
    selectable.length > 0 && selectedInView.length === selectable.length;

  const toggle = (code: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const act of selectable) {
        if (checked) next.add(act.code);
        else next.delete(act.code);
      }
      return next;
    });

  const chapterItems = [
    { label: NGAP_COPY.allChapters, value: null },
    ...(data?.chapters ?? []).map((name) => ({ label: name, value: name })),
  ];

  return (
    <div className="flex max-h-[75vh] flex-col gap-4 px-4">
      <Alert>
        <InfoIcon />
        <AlertDescription>{NGAP_COPY.importBanner}</AlertDescription>
      </Alert>

      <div
        data-pending={isFetching ? "" : undefined}
        className="flex flex-col gap-2 data-pending:opacity-70 sm:flex-row"
      >
        <Select
          value={chapter}
          onValueChange={(value) => setChapter(value ?? null)}
          items={chapterItems}
        >
          <SelectTrigger
            size="default"
            className="h-9 sm:w-48"
            aria-label={NGAP_COPY.chapterLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chapterItems.map((item) => (
              <SelectItem key={item.label} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <InputGroup className="h-9 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={NGAP_COPY.searchLabel}
            placeholder={NGAP_COPY.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={allSelected}
          indeterminate={selectedInView.length > 0 && !allSelected}
          disabled={selectable.length === 0}
          onCheckedChange={(checked) => toggleAll(checked === true)}
        />
        {NGAP_COPY.selectAll}
      </label>

      <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border">
        {isPending ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Spinner aria-hidden="true" />
            {NGAP_COPY.pickerLoading}
          </div>
        ) : isError ? (
          <p className="text-danger-strong py-10 text-center text-sm">
            {NGAP_COPY.loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {NGAP_COPY.noResult}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((act) => (
              <li key={act.code}>
                <label
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 text-sm",
                    act.alreadyInCatalogue
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-muted cursor-pointer",
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={act.alreadyInCatalogue || selected.has(act.code)}
                    disabled={act.alreadyInCatalogue}
                    onCheckedChange={(checked) =>
                      toggle(act.code, checked === true)
                    }
                  />
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
                    {act.code}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-foreground">{act.designation}</span>
                    <NgapReference {...act} />
                  </span>
                  {act.alreadyInCatalogue && (
                    <StatusBadge
                      label={NGAP_COPY.alreadyInCatalogue}
                      tone="brand"
                      className="shrink-0"
                    />
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > items.length && (
        <p className="text-muted-foreground text-xs">
          {ngapTruncatedMessage(items.length, data.total)}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={importNgap.isPending}
          onClick={onDone}
          className="w-full sm:w-auto"
        >
          {SERVICE_COPY.cancel}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={selected.size === 0 || importNgap.isPending}
          onClick={() => importNgap.mutate({ codes: [...selected] })}
          className="w-full sm:w-auto"
        >
          {importNgap.isPending && <Spinner aria-label={NGAP_COPY.importing} />}
          {importNgap.isPending
            ? NGAP_COPY.importing
            : importButtonLabel(selected.size)}
        </Button>
      </div>
    </div>
  );
};

export default ImportNgapDialog;
