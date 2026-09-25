"use client";

import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";

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
import { useTRPC } from "@/trpc/client";
import { usePatientsFilters } from "../hooks/use-patients-filters";
import NewPatientDialog from "./new-patient-dialog";

const ALL_TAGS_LABEL = "Tous les tags";
const ALL_INSURERS_LABEL = "Toutes les assurances";

const PatientsListHeader = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = usePatientsFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen instead of flashing
  // the loading state on every keystroke.
  const [isFiltering, startTransition] = useTransition();

  // Options for the two filter selects. Both are prefetched by the route, so
  // this resolves from the dehydrated cache with no request; `useQuery` rather
  // than `useSuspenseQuery` because the header sits outside the Suspense
  // boundary (04-hydration.md §4 rule 8).
  const { data: tags } = useQuery(trpc.tags.getMany.queryOptions());
  const { data: insurers } = useQuery(trpc.insurers.getMany.queryOptions());

  const hasFilters = Boolean(
    filters.search || filters.tagId || filters.insurerId,
  );

  // Any filter that narrows the results sends the user back to page 1 —
  // otherwise a 3-result search lands on an empty page 4 (05-slice.md §4).
  const narrow = (next: Partial<typeof filters>) =>
    startTransition(() => {
      void setFilters({ ...next, page: DEFAULT_PAGE });
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-foreground">Patients</h1>
        <Button size="lg" onClick={() => setIsDialogOpen(true)}>
          <PlusIcon />
          Nouveau patient
        </Button>
      </div>

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
            aria-label="Rechercher un patient"
            placeholder="Rechercher un patient…"
            value={filters.search}
            onChange={(event) => narrow({ search: event.target.value })}
          />
        </InputGroup>

        <Select
          value={filters.tagId || null}
          onValueChange={(value) => narrow({ tagId: value ?? "" })}
          items={[
            { label: ALL_TAGS_LABEL, value: null },
            ...(tags?.items.map((tag) => ({
              label: tag.label,
              value: tag.id,
            })) ?? []),
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{ALL_TAGS_LABEL}</SelectItem>
            {tags?.items.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.insurerId || null}
          onValueChange={(value) => narrow({ insurerId: value ?? "" })}
          items={[
            { label: ALL_INSURERS_LABEL, value: null },
            ...(insurers?.items.map((insurer) => ({
              label: insurer.name,
              value: insurer.id,
            })) ?? []),
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{ALL_INSURERS_LABEL}</SelectItem>
            {insurers?.items.map((insurer) => (
              <SelectItem key={insurer.id} value={insurer.id}>
                {insurer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() =>
              narrow({ search: "", tagId: "", insurerId: "" })
            }
          >
            <XIcon />
            Effacer les filtres
          </Button>
        )}
      </div>

      <NewPatientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default PatientsListHeader;
