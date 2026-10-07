"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useMemo, useTransition } from "react";

import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { clinicNow, toClinicDate } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_COPY } from "../../constants";
import { useAppointmentsFilters } from "../../hooks/use-appointments-filters";
import { resolveAnchorDate } from "../../lib/get-range-for-view";
import { AppointmentStatus } from "../../types";
import {
  dialogRenderer,
  fromCalendarAnchor,
  fromCalendarMove,
  fromCalendarView,
  toCalendarAnchor,
  toCalendarEvent,
  toCalendarView,
} from "../calendar-adapter";
import { CalendarDialogs } from "../calendar-dialogs";
import { calendarQueryInput, toPractitionerParam } from "../calendar-query";
import { CalendarToolbar } from "../calendar-toolbar";
import { useMoveAppointment } from "../use-move-appointment";

/**
 * Client-only at the slice boundary (07-calendar.md §2 patch 14): the
 * calendar seeds `useState(new Date())` and runs an unguarded
 * `useLayoutEffect`. `ssr: false` is only allowed in a Client Component.
 */
const EventCalendar = dynamic(
  () => import("@/components/calendar").then((mod) => mod.EventCalendar),
  { ssr: false, loading: () => <AppointmentsCalendarLoading /> },
);

const PAGE_TITLE = "Calendrier";

interface AppointmentsCalendarViewProps {
  /** The signed-in practitioner, or "" — the filter's default. */
  defaultPractitionerId: string;
}

/**
 * `/calendrier`. `date`, `view` and `practitionerId` live in the URL and drive
 * the calendar as a controlled component; the range is derived from them, by
 * the procedure, through `getRangeForView` (07-calendar.md §7).
 */
const AppointmentsCalendarView = ({
  defaultPractitionerId,
}: AppointmentsCalendarViewProps) => {
  const trpc = useTRPC();
  const [filters, setFilters] = useAppointmentsFilters();
  // Client-side only: it filters rows already fetched, never the query key.
  const [showCanceled, setShowCanceled] = useQueryState(
    "canceled",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
  );
  const [isNavigating, startTransition] = useTransition();

  // The same input the page prefetched, built by the same function.
  const input = calendarQueryInput(filters, defaultPractitionerId);
  const { data } = useSuspenseQuery(
    trpc.appointments.getMany.queryOptions(input),
  );

  // Mandatory memo (07-calendar.md §4): a fresh array on every render re-runs
  // every view's layout chain, including on each pointer move of a drag.
  const events = useMemo(
    () =>
      data.items
        .filter(
          (appointment) =>
            showCanceled || appointment.status !== AppointmentStatus.Canceled,
        )
        .map(toCalendarEvent),
    [data.items, showCanceled],
  );

  const anchor = resolveAnchorDate(filters.date);
  const date = useMemo(() => toCalendarAnchor(anchor), [anchor]);

  const [MoveConfirmDialog, moveAppointment] = useMoveAppointment(data.items);

  const renderDialog = useMemo(
    () =>
      dialogRenderer((intent, onClose) => (
        <CalendarDialogs
          intent={intent}
          onClose={onClose}
          appointments={data.items}
          practitionerId={input.practitionerId}
        />
      )),
    [data.items, input.practitionerId],
  );

  const update = (next: Parameters<typeof setFilters>[0]) =>
    startTransition(() => {
      void setFilters(next);
    });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <h1 className="font-heading text-h1 text-foreground">{PAGE_TITLE}</h1>

      <CalendarToolbar
        practitionerId={input.practitionerId}
        onPractitionerChange={(practitionerId) =>
          update({
            practitionerId: toPractitionerParam(
              practitionerId,
              defaultPractitionerId,
            ),
          })
        }
        showCanceled={showCanceled}
        onShowCanceledChange={(next) => void setShowCanceled(next)}
        isPending={isNavigating}
      />

      <EventCalendar
        events={events}
        date={date}
        onDateChange={(next) => {
          const day = fromCalendarAnchor(next);
          // Today stays "" — a clean URL that follows the clinic's clock.
          update({ date: day === toClinicDate(clinicNow()) ? "" : day });
        }}
        view={toCalendarView(filters.view)}
        onViewChange={(next) => update({ view: fromCalendarView(next) })}
        onEventUpdate={(event) => void moveAppointment(fromCalendarMove(event))}
        renderDialog={renderDialog}
        enableShortcuts
      />

      <MoveConfirmDialog />
    </div>
  );
};

export const AppointmentsCalendarLoading = () => (
  <LoadingState
    title={APPOINTMENT_COPY.loadingTitle}
    description={APPOINTMENT_COPY.loadingDescription}
  />
);

export const AppointmentsCalendarError = () => (
  <ErrorState
    title={APPOINTMENT_COPY.errorTitle}
    description={APPOINTMENT_COPY.errorDescription}
  />
);

export default AppointmentsCalendarView;
