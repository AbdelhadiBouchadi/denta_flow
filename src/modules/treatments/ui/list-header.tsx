"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE, WEEK_STARTS_ON } from "@/constants";
import { formatCalendarDate } from "@/lib/format";
import { clinicNow, isCalendarDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import { TREATMENT_COPY as COPY, TREATMENT_STATUS_OPTIONS } from "../constants";
import { useTreatmentsFilters } from "../hooks/use-treatments-filters";
import NewTreatmentDialog from "./new-treatment-dialog";

/**
 * No reference screen exists for `/actes`: built from the `/patients` and
 * `/rendez-vous` headers — title and primary action, then the filter row.
 */
const TreatmentsListHeader = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useTreatmentsFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Prefetched by the route; `useQuery` because the header sits outside the
  // Suspense boundary (04-hydration.md §4 rule 8).
  const { data: practitioners } = useQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.practitionerId ||
      filters.from ||
      filters.to,
  );

  // Every narrowing change goes back to page 1 (05-slice.md §4).
  const narrow = (next: Omit<Partial<typeof filters>, "page">) =>
    startTransition(() => {
      void setFilters({ ...next, page: DEFAULT_PAGE });
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-foreground">
          {COPY.pageTitle}
        </h1>
        <Button size="lg" onClick={() => setIsDialogOpen(true)}>
          <PlusIcon />
          {COPY.newButton}
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
            aria-label={COPY.searchLabel}
            placeholder={COPY.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>

        <Select
          value={filters.status}
          onValueChange={(value) => narrow({ status: value })}
          items={[
            { label: COPY.allStatuses, value: null },
            ...TREATMENT_STATUS_OPTIONS,
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allStatuses}</SelectItem>
            {TREATMENT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.practitionerId || null}
          onValueChange={(value) => narrow({ practitionerId: value ?? "" })}
          items={[
            { label: COPY.allPractitioners, value: null },
            ...(practitioners?.items.map((p) => ({
              label: p.name,
              value: p.id,
            })) ?? []),
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allPractitioners}</SelectItem>
            {practitioners?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
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
              narrow({
                search: "",
                status: null,
                practitionerId: "",
                from: "",
                to: "",
              });
            }}
          >
            <XIcon />
            {COPY.clearFilters}
          </Button>
        )}
      </div>

      <NewTreatmentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

/**
 * One end of the date range, a clinic calendar day ("" ⇒ open). The picker's
 * Date is only read for its calendar fields; the procedure turns the day into
 * clinic-midnight instants through TZDate.
 */
const DayFilter = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
}) => {
  const day = isCalendarDate(value) ? value : "";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="min-w-36 justify-between font-normal tabular-nums"
          />
        }
      >
        <span>
          <span className="text-muted-foreground">{label} </span>
          {day ? formatCalendarDate(day) : "—"}
        </span>
        <CalendarIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={WEEK_STARTS_ON}
          defaultMonth={day ? parseISO(day) : clinicNow()}
          selected={day ? parseISO(day) : undefined}
          onSelect={(picked) =>
            onChange(picked ? format(picked, "yyyy-MM-dd") : "")
          }
        />
      </PopoverContent>
    </Popover>
  );
};

export default TreatmentsListHeader;
