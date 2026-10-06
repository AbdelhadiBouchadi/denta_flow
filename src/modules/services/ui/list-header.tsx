"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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
import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import {
  SEARCH_DEBOUNCE_MS,
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_COPY,
  SERVICE_STATUS_FILTER_OPTIONS,
} from "../constants";
import { useServicesFilters } from "../hooks/use-services-filters";
import { ServiceStatusFilter } from "../types";
import CatalogueButtons from "./catalogue-buttons";

const CATEGORY_ITEMS = [
  { label: SERVICE_COPY.allCategories, value: null },
  ...SERVICE_CATEGORY_OPTIONS,
];

/**
 * The «Actes» section heading and toolbar. Admins get the two buttons;
 * everyone else reads why there are none. Both are cosmetic — every write is
 * an `adminProcedure`. Until the session resolves neither shows.
 */
const ServicesListHeader = () => {
  const [filters, setFilters] = useServicesFilters();
  const [searchInput, setSearchInput] = useState(filters.search);
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen instead of flashing
  // the loading state on every keystroke.
  const [isFiltering, startTransition] = useTransition();

  // Any filter that narrows the results sends the user back to page 1
  // (05-slice.md §4).
  const narrow = (next: Partial<typeof filters>) =>
    startTransition(() => {
      void setFilters({ ...next, page: DEFAULT_PAGE });
    });

  useEffect(() => setSearchInput(filters.search), [filters.search]);
  useEffect(() => {
    if (searchInput === filters.search) return;
    const id = window.setTimeout(
      () => narrow({ search: searchInput }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
    // `narrow` is recreated each render; the debounce keys on the text only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.status !== ServiceStatusFilter.All,
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-h3 text-foreground">
            {SERVICE_COPY.sectionTitle}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {SERVICE_COPY.sectionDescription}
          </p>
        </div>

        {isAdmin && <CatalogueButtons />}
      </div>

      {!isAdmin && !isSessionPending && (
        <p className="text-muted-foreground text-sm">{SERVICE_COPY.adminOnly}</p>
      )}

      <div
        data-pending={isFiltering ? "" : undefined}
        className="flex flex-wrap items-center gap-2 data-pending:opacity-70"
      >
        <InputGroup className="h-9 w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={SERVICE_COPY.searchLabel}
            placeholder={SERVICE_COPY.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>

        <Select
          value={filters.category}
          onValueChange={(value) => narrow({ category: value ?? null })}
          items={CATEGORY_ITEMS}
        >
          <SelectTrigger
            size="default"
            className="h-9 min-w-48"
            aria-label={SERVICE_COPY.categoryFilterLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ITEMS.map((item) => (
              <SelectItem key={item.label} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            narrow({ status: value ?? ServiceStatusFilter.All })
          }
          items={SERVICE_STATUS_FILTER_OPTIONS}
        >
          <SelectTrigger
            size="default"
            className="h-9 min-w-40"
            aria-label={SERVICE_COPY.statusFilterLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setSearchInput("");
              narrow({
                search: "",
                category: null,
                status: ServiceStatusFilter.All,
              });
            }}
          >
            <XIcon />
            {SERVICE_COPY.clearFilters}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ServicesListHeader;
