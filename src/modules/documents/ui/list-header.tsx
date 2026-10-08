"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import DayFilter from "@/components/shared/day-filter";
import { Button } from "@/components/ui/button";
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
import { DEFAULT_PAGE } from "@/constants";
import { DOCUMENT_COPY as COPY, DOCUMENT_TYPE_OPTIONS } from "../constants";
import { useDocumentsFilters } from "../hooks/use-documents-filters";

/**
 * The `/documents` header: the same title, filter row and behaviour as
 * `/paiements`. No primary action: a document is generated from a patient's
 * dossier, where its actes are.
 */
const DocumentsListHeader = () => {
  const [filters, setFilters] = useDocumentsFilters();
  const [searchInput, setSearchInput] = useState(filters.search);

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen meanwhile.
  const [isFiltering, startTransition] = useTransition();

  // The URL's search changed from elsewhere (back button, «Effacer»): re-seed
  // the input during render rather than in an effect.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (syncedSearch !== filters.search) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  // Debounced: the URL — and the query key — follow the input 300 ms later,
  // back on page 1.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const id = window.setTimeout(
      () =>
        startTransition(() => {
          void setFilters({ search: searchInput, page: DEFAULT_PAGE });
        }),
      300,
    );
    return () => window.clearTimeout(id);
  }, [searchInput, filters.search, setFilters]);

  const hasFilters = Boolean(
    filters.search || filters.type || filters.from || filters.to,
  );

  // Every narrowing change goes back to page 1 (05-slice.md §4).
  const narrow = (next: Omit<Partial<typeof filters>, "page">) =>
    startTransition(() => {
      void setFilters({ ...next, page: DEFAULT_PAGE });
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <h1 className="font-heading text-h1 text-foreground">{COPY.pageTitle}</h1>

      <div
        data-pending={isFiltering ? "" : undefined}
        className="flex flex-wrap items-center gap-2 data-pending:opacity-70"
      >
        <InputGroup className="h-9 w-full max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={COPY.searchLabel}
            placeholder={COPY.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>

        <Select
          value={filters.type}
          onValueChange={(value) => narrow({ type: value })}
          items={[{ label: COPY.allTypes, value: null }, ...DOCUMENT_TYPE_OPTIONS]}
        >
          <SelectTrigger size="default" className="h-9 min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allTypes}</SelectItem>
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DayFilter
          label={COPY.from}
          value={filters.from}
          onChange={(from) => narrow({ from })}
        />
        <DayFilter
          label={COPY.to}
          value={filters.to}
          onChange={(to) => narrow({ to })}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setSearchInput("");
              narrow({ search: "", type: null, from: "", to: "" });
            }}
          >
            <XIcon />
            {COPY.clearFilters}
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentsListHeader;
