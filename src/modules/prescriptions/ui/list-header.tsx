"use client";

import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
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
import { canWriteMedicalDocuments } from "@/modules/documents/rules";
import {
  MEDICATION_STATUS_FILTER_OPTIONS,
  PRESCRIPTION_COPY as COPY,
} from "../constants";
import { usePrescriptionsFilters } from "../hooks/use-prescriptions-filters";
import { MedicationStatusFilter } from "../types";
import MedicationDialog from "./medication-dialog";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The «Médicaments et packs» heading and the medication toolbar — the same
 * shape and behaviour as «Actes». The add button is for admins and dentists;
 * it is a courtesy, every write is a `medicalWriterProcedure`.
 */
const PrescriptionsListHeader = () => {
  const [filters, setFilters] = usePrescriptionsFilters();
  const [searchInput, setSearchInput] = useState(filters.medSearch);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const canWrite = canWriteMedicalDocuments(session?.user.role);
  const [isFiltering, startTransition] = useTransition();

  // Every narrowing change goes back to page 1 (05-slice.md §4).
  const narrow = (next: Omit<Partial<typeof filters>, "medPage">) =>
    startTransition(() => {
      void setFilters({ ...next, medPage: DEFAULT_PAGE });
    });

  // The URL changed under the box (back button, «Effacer»): the box follows.
  const [syncedSearch, setSyncedSearch] = useState(filters.medSearch);
  if (filters.medSearch !== syncedSearch) {
    setSyncedSearch(filters.medSearch);
    setSearchInput(filters.medSearch);
  }

  useEffect(() => {
    if (searchInput === filters.medSearch) return;
    const id = window.setTimeout(
      () =>
        startTransition(() => {
          void setFilters({ medSearch: searchInput, medPage: DEFAULT_PAGE });
        }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
  }, [searchInput, filters.medSearch, setFilters]);

  const hasFilters = Boolean(
    filters.medSearch || filters.medStatus !== MedicationStatusFilter.All,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-heading text-h3 text-foreground">
          {COPY.sectionTitle}
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {COPY.sectionDescription}
        </p>
      </div>

      {!canWrite && !isSessionPending && (
        <p className="text-muted-foreground text-sm">{COPY.readOnly}</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-heading text-h4 text-foreground">
          {COPY.medicationsTitle}
        </h3>
        {canWrite && (
          <Button size="lg" onClick={() => setIsNewOpen(true)}>
            <PlusIcon />
            {COPY.addMedicationButton}
          </Button>
        )}
      </div>

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
            aria-label={COPY.searchLabel}
            placeholder={COPY.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>

        <Select
          value={filters.medStatus}
          onValueChange={(value) =>
            narrow({ medStatus: value ?? MedicationStatusFilter.All })
          }
          items={MEDICATION_STATUS_FILTER_OPTIONS}
        >
          <SelectTrigger
            size="default"
            className="h-9 min-w-40"
            aria-label={COPY.statusFilterLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEDICATION_STATUS_FILTER_OPTIONS.map((option) => (
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
              narrow({ medSearch: "", medStatus: MedicationStatusFilter.All });
            }}
          >
            <XIcon />
            {COPY.clearFilters}
          </Button>
        )}
      </div>

      {isNewOpen && <MedicationDialog open onOpenChange={setIsNewOpen} />}
    </div>
  );
};

export default PrescriptionsListHeader;
