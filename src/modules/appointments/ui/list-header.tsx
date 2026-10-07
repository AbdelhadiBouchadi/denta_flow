"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc/client";
import {
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_OPTIONS,
  CALENDAR_VIEW_OPTIONS,
} from "../constants";
import { useAppointmentsFilters } from "../hooks/use-appointments-filters";
import {
  addCalendarDays,
  getDaysForView,
  resolveAnchorDate,
  shiftAnchorDate,
} from "../lib/get-range-for-view";
import { CalendarView } from "../types";
import { withPageReset } from "../pagination";
import NewAppointmentDialog from "./new-appointment-dialog";

const formatDay = (date: string, pattern: string) =>
  format(parseISO(date), pattern, { locale: fr });

/** «lundi 15 juin 2026», «juin 2026», «15 juin 2026 – 21 juin 2026». */
const periodLabel = (date: string, view: CalendarView) => {
  if (view === CalendarView.Day) return formatDay(date, "EEEE d MMMM yyyy");
  if (view === CalendarView.Month) return formatDay(date, "MMMM yyyy");
  const { first, afterLast } = getDaysForView(date, view);
  return `${formatDay(first, "d MMM yyyy")} – ${formatDay(addCalendarDays(afterLast, -1), "d MMM yyyy")}`;
};

const AppointmentsListHeader = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useAppointmentsFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen meanwhile.
  const [isFiltering, startTransition] = useTransition();

  // Prefetched by the route; `useQuery` because the header sits outside the
  // Suspense boundary (04-hydration.md §4 rule 8).
  const { data: practitioners } = useQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );

  const anchor = resolveAnchorDate(filters.date);
  const hasFilters = Boolean(
    filters.practitionerId || filters.status || filters.patientId,
  );

  // Every change here — range, view or filter — goes back to page 1.
  const update = (next: Omit<Partial<typeof filters>, "page">) =>
    startTransition(() => {
      void setFilters(withPageReset(next));
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-foreground">
          {APPOINTMENT_COPY.pageTitle}
        </h1>
        <Button size="lg" onClick={() => setIsDialogOpen(true)}>
          <PlusIcon />
          {APPOINTMENT_COPY.newButton}
        </Button>
      </div>

      <div
        data-pending={isFiltering ? "" : undefined}
        className="flex flex-wrap items-center gap-2 data-pending:opacity-70"
      >
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={APPOINTMENT_COPY.previous}
            onClick={() =>
              update({ date: shiftAnchorDate(anchor, filters.view, -1) })
            }
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="lg"
            // "" is today — and the URL stays clean.
            onClick={() => update({ date: "" })}
          >
            {APPOINTMENT_COPY.today}
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={APPOINTMENT_COPY.next}
            onClick={() =>
              update({ date: shiftAnchorDate(anchor, filters.view, 1) })
            }
          >
            <ChevronRightIcon />
          </Button>
        </div>

        {/* "Today" is read on each side's clock; around midnight the server
            and the browser may name different days. */}
        <span
          suppressHydrationWarning
          className="text-foreground min-w-48 px-2 font-medium first-letter:uppercase"
        >
          {periodLabel(anchor, filters.view)}
        </span>

        <Select
          value={filters.view}
          onValueChange={(value) => value && update({ view: value })}
          items={CALENDAR_VIEW_OPTIONS}
        >
          <SelectTrigger size="default" className="h-9 min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.practitionerId || null}
          onValueChange={(value) => update({ practitionerId: value ?? "" })}
          items={[
            { label: APPOINTMENT_COPY.allPractitioners, value: null },
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
            <SelectItem value={null}>
              {APPOINTMENT_COPY.allPractitioners}
            </SelectItem>
            {practitioners?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => update({ status: value })}
          items={[
            { label: APPOINTMENT_COPY.allStatuses, value: null },
            ...APPOINTMENT_STATUS_OPTIONS,
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{APPOINTMENT_COPY.allStatuses}</SelectItem>
            {APPOINTMENT_STATUS_OPTIONS.map((option) => (
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
            onClick={() =>
              update({ practitionerId: "", status: null, patientId: "" })
            }
          >
            <XIcon />
            {APPOINTMENT_COPY.clearFilters}
          </Button>
        )}
      </div>

      <NewAppointmentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default AppointmentsListHeader;
