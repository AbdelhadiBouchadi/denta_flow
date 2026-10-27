"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import DataPagination from "@/components/shared/data-pagination";
import { DataTable, type DataTableFeatures } from "@/components/shared/data-table";
import DayFilter from "@/components/shared/day-filter";
import StatusBadge from "@/components/shared/status-badge";
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
import { formatDateTime } from "@/lib/format";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_LABELS,
  EVENT_OPTIONS,
  EVENT_TONES,
  JOURNAL_PAGE_SIZE,
  STATUS_OPTIONS,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useWhatsappFilters } from "../hooks/use-whatsapp-filters";
import { journalQueryInput } from "../query-inputs";
import type { WhatsappJournalRow } from "../types";
import { MessageStatusBadge } from "./message-status-badge";
import { RappelActions } from "./rappel-actions";

const columns: ColumnDef<DataTableFeatures, WhatsappJournalRow>[] = [
  {
    id: "at",
    header: COPY.colDate,
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDateTime(row.original.at)}</span>
    ),
  },
  {
    id: "patient",
    header: COPY.colPatient,
    cell: ({ row }) => (
      <Link
        href={`/patients/${row.original.patient.id}`}
        className="text-foreground font-medium underline-offset-4 hover:underline"
      >
        {row.original.patient.name}
      </Link>
    ),
  },
  {
    id: "event",
    header: COPY.colEvent,
    cell: ({ row }) =>
      row.original.event && (
        <StatusBadge
          label={EVENT_LABELS[row.original.event]}
          tone={EVENT_TONES[row.original.event]}
        />
      ),
    meta: { className: "hidden md:table-cell" },
  },
  {
    id: "appointment",
    header: COPY.colAppointment,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(row.original.startsAt)}
      </span>
    ),
    meta: { className: "hidden lg:table-cell" },
  },
  {
    id: "status",
    header: COPY.colStatus,
    cell: ({ row }) => (
      <MessageStatusBadge
        status={row.original.status}
        skipReason={row.original.skipReason}
        errorCode={row.original.errorCode}
        errorMessage={row.original.errorMessage}
      />
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{COPY.colActions}</span>,
    cell: ({ row }) => <RappelActions row={row.original} />,
  },
];

/** «Journal d’envois» — the history, filterable, 25 per page. */
export const JournalTab = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useWhatsappFilters();
  const [isPending, startTransition] = useTransition();
  const { data } = useSuspenseQuery(
    trpc.whatsapp.getJournal.queryOptions(journalQueryInput(filters)),
  );

  const [search, setSearch] = useState(filters.waSearch);
  const [syncedSearch, setSyncedSearch] = useState(filters.waSearch);
  if (syncedSearch !== filters.waSearch) {
    setSyncedSearch(filters.waSearch);
    setSearch(filters.waSearch);
  }
  useEffect(() => {
    if (search === filters.waSearch) return;
    const id = window.setTimeout(
      () =>
        startTransition(() => {
          void setFilters({ waSearch: search, waPage: DEFAULT_PAGE });
        }),
      300,
    );
    return () => window.clearTimeout(id);
  }, [search, filters.waSearch, setFilters]);

  // Every narrowing filter goes back to page 1.
  const narrow = (next: Partial<typeof filters>) =>
    startTransition(() => {
      void setFilters({ ...next, waPage: DEFAULT_PAGE });
    });

  return (
    <div
      data-pending={isPending ? "" : undefined}
      className="flex min-w-0 flex-col gap-4 data-pending:opacity-70"
    >
      <div className="flex flex-wrap items-center gap-2">
        <DayFilter
          label={COPY.journalFrom}
          value={data.from}
          onChange={(day) => narrow({ waFrom: day })}
        />
        <DayFilter
          label={COPY.journalTo}
          value={data.to}
          onChange={(day) => narrow({ waTo: day })}
        />
        <Select
          value={filters.waEvent}
          onValueChange={(value) => narrow({ waEvent: value ?? null })}
          items={[{ value: null, label: COPY.allEvents }, ...EVENT_OPTIONS]}
        >
          <SelectTrigger className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allEvents}</SelectItem>
            {EVENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.waStatus}
          onValueChange={(value) => narrow({ waStatus: value ?? null })}
          items={[{ value: null, label: COPY.allStatuses }, ...STATUS_OPTIONS]}
        >
          <SelectTrigger className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allStatuses}</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InputGroup className="h-9 w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={COPY.journalSearch}
            placeholder={COPY.journalSearch}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>

      <DataTable columns={columns} data={data.items} />
      {data.items.length === 0 && (
        <p className="text-muted-foreground text-center text-sm">{COPY.journalEmpty}</p>
      )}
      <DataPagination
        page={filters.waPage}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={JOURNAL_PAGE_SIZE}
        onPageChange={(page) =>
          startTransition(() => {
            void setFilters({ waPage: page });
          })
        }
      />
    </div>
  );
};
