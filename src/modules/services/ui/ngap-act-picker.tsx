"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import {
  NGAP_COPY,
  NGAP_PICKER_LIMIT,
  SERVICE_FIELD_LABELS,
  SERVICE_FIELD_PLACEHOLDERS,
} from "../constants";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import type { NgapSearchItem } from "../types";
import { NgapReference } from "./ngap-reference";

interface NgapActPickerProps {
  id?: string;
  disabled?: boolean;
  onPick: (act: NgapSearchItem) => void;
}

/**
 * «Partir de la nomenclature NGAP» — a combobox over `services.searchNgap`,
 * debounced and filtered server-side (cmdk's own filter is off).
 *
 * Inline rather than in a popover: it lives inside a Dialog on desktop and a
 * Drawer on mobile, and a list in the flow of the form needs no second
 * floating layer on top of either.
 */
export const NgapActPicker = ({ id, disabled, onPick }: NgapActPickerProps) => {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim());

  const { data, isFetching } = useQuery({
    ...trpc.services.searchNgap.queryOptions({
      query: debouncedQuery,
      limit: NGAP_PICKER_LIMIT,
    }),
    enabled: debouncedQuery.length > 0,
    placeholderData: keepPreviousData,
  });

  const showList = isOpen && query.trim().length > 0;
  const isSearching = isFetching || query.trim() !== debouncedQuery;
  const items = data?.items ?? [];

  return (
    <Command
      shouldFilter={false}
      className="bg-background rounded-lg! border p-0"
      label={SERVICE_FIELD_LABELS.ngapPicker}
    >
      <CommandInput
        id={id}
        value={query}
        disabled={disabled}
        placeholder={SERVICE_FIELD_PLACEHOLDERS.ngapPicker}
        onValueChange={(value) => {
          setQuery(value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && showList) {
            // Close the list, not the dialog around it.
            event.stopPropagation();
            setIsOpen(false);
          }
        }}
      />

      {showList && (
        <CommandList className="max-h-60 p-1">
          {isSearching && items.length === 0 ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Spinner aria-hidden="true" />
              {NGAP_COPY.pickerLoading}
            </div>
          ) : (
            <CommandEmpty className="text-muted-foreground py-6 text-sm">
              {NGAP_COPY.pickerEmpty}
            </CommandEmpty>
          )}

          {items.map((act) => (
            <CommandItem
              key={act.code}
              value={act.code}
              onSelect={() => {
                onPick(act);
                setQuery("");
                setIsOpen(false);
              }}
              className="items-start"
            >
              <span className="bg-muted text-muted-foreground mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
                {act.code}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-foreground line-clamp-2">
                  {act.designation}
                </span>
                <NgapReference {...act} />
              </span>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  );
};
