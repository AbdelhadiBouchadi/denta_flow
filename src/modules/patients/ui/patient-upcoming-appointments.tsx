"use client";

import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { PencilIcon, RotateCcwIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { FallbackProps } from "react-error-boundary";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APPOINTMENT_COPY } from "@/modules/appointments/constants";
import type { AppointmentListItem } from "@/modules/appointments/types";
import UpdateAppointmentDialog from "@/modules/appointments/ui/update-appointment-dialog";
import { useTRPC } from "@/trpc/client";

const COPY = {
  title: "Prochains rendez-vous",
  empty: "Aucun rendez-vous à venir.",
  loading: "Chargement des prochains rendez-vous…",
  error: "Les prochains rendez-vous n’ont pas pu être chargés.",
  retry: "Réessayer",
} as const;

/**
 * The titled section every state renders in — data, loading and error — so
 * the header keeps its shape whatever the read does.
 */
const UpcomingFrame = ({ children }: { children: ReactNode }) => (
  <section
    aria-labelledby="upcoming-appointments-title"
    className="flex w-full min-w-0 flex-col gap-2"
  >
    <h2
      id="upcoming-appointments-title"
      className="text-muted-foreground text-label"
    >
      {COPY.title}
    </h2>
    {children}
  </section>
);

interface PatientUpcomingAppointmentsProps {
  patientId: string;
}

/**
 * The header's «Prochains rendez-vous» — the reference's cards beside the
 * actions. `appointments.getUpcomingByPatient` (prefetched by the page) picks
 * the next three non-terminal bookings in SQL; a card opens the shared edit
 * dialog, whose save invalidates the whole appointments router, this read
 * included.
 *
 * Below `lg` the cards are a horizontal strip that scrolls INSIDE its own
 * box: the list is `overflow-x-auto` and every ancestor up to the card is
 * `min-w-0`, so three cards never push the page wider than the screen.
 *
 * The header wraps it in its OWN Suspense and ErrorBoundary (the Loading and
 * Error exports below): this read is secondary, and a failure here must never
 * take down the dossier — or «Modifier», «+ Paiement» beside it — with it.
 */
const PatientUpcomingAppointments = ({
  patientId,
}: PatientUpcomingAppointmentsProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.appointments.getUpcomingByPatient.queryOptions({ patientId }),
  );
  // Dialog state, not page state: which booking is being edited.
  const [editing, setEditing] = useState<AppointmentListItem | null>(null);

  return (
    <UpcomingFrame>
      {data.items.length === 0 ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          {COPY.empty}
        </p>
      ) : (
        <ul className="flex min-w-0 snap-x gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {data.items.map((item) => (
            <li key={item.id} className="w-60 shrink-0 snap-start lg:w-full">
              <UpcomingCard item={item} onOpen={setEditing} />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <UpdateAppointmentDialog
          // A different card is a different booking: fresh form state.
          key={editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          initialValues={editing}
        />
      )}
    </UpcomingFrame>
  );
};

const UpcomingCard = ({
  item,
  onOpen,
}: {
  item: AppointmentListItem;
  onOpen: (item: AppointmentListItem) => void;
}) => (
  <button
    type="button"
    onClick={() => onOpen(item)}
    className="bg-muted/50 hover:bg-muted focus-visible:ring-ring/50 group flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-3"
  >
    {/* The colour is data — the palette value stored on the type. */}
    <span
      aria-hidden="true"
      style={
        item.type ? ({ "--type-color": item.type.color } as CSSProperties) : undefined
      }
      className={cn(
        "mt-1.5 size-2.5 shrink-0 rounded-full",
        item.type ? "bg-[var(--type-color)]" : "bg-muted-foreground",
      )}
    />
    <span className="flex min-w-0 flex-1 flex-col text-sm leading-snug">
      <span className="text-foreground truncate font-medium">
        {item.type?.label ?? APPOINTMENT_COPY.noType}
      </span>
      {/* Clinic wall clock; see the appointments list on the warning. */}
      <span
        suppressHydrationWarning
        className="text-muted-foreground text-xs tabular-nums"
      >
        {formatDate(item.startsAt)} · {formatTime(item.startsAt)} –{" "}
        {formatTime(item.endsAt)}
      </span>
      <span className="text-muted-foreground truncate text-xs">
        {item.practitioner?.name ?? APPOINTMENT_COPY.noPractitioner}
      </span>
    </span>
    <PencilIcon
      aria-hidden="true"
      className="text-muted-foreground group-hover:text-foreground mt-0.5 size-3.5 shrink-0"
    />
  </button>
);

/** One placeholder card while the read is in flight — never the whole dossier. */
export const PatientUpcomingAppointmentsLoading = () => (
  <UpcomingFrame>
    <Skeleton
      aria-label={COPY.loading}
      role="status"
      className="h-16 w-60 rounded-lg lg:w-full"
    />
  </UpcomingFrame>
);

/**
 * A failed read stays in its box. «Réessayer» clears the failed query first —
 * otherwise `useSuspenseQuery` would rethrow the cached error — then resets
 * the boundary, which re-renders the widget and refetches (the dashboard
 * view's pattern).
 */
export const PatientUpcomingAppointmentsError = ({
  resetErrorBoundary,
}: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <UpcomingFrame>
      <div
        role="alert"
        className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
      >
        <p className="text-muted-foreground text-sm">{COPY.error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            resetErrorBoundary();
          }}
        >
          <RotateCcwIcon />
          {COPY.retry}
        </Button>
      </div>
    </UpcomingFrame>
  );
};

export default PatientUpcomingAppointments;
