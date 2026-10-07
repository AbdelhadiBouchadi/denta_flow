"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";

import EmptyState from "@/components/shared/empty-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
} from "@/modules/appointments/constants";
import {
  AppointmentStatus,
  type AppointmentByPatientItem,
} from "@/modules/appointments/types";
import NewAppointmentDialog from "@/modules/appointments/ui/new-appointment-dialog";
import UpdateAppointmentDialog from "@/modules/appointments/ui/update-appointment-dialog";
import { useTRPC } from "@/trpc/client";
import type { PatientGetOne } from "../types";

/** The tab's own copy, like the dossier's other panels. */
const COPY = {
  upcoming: "À venir",
  past: "Passés",
  newAppointment: "Nouveau rendez-vous",
  empty: "Aucun rendez-vous.",
  emptyDescription:
    "Les rendez-vous de ce patient, à venir et passés, s’afficheront ici.",
  /** Shown when the cap hides the oldest rows. */
  truncated: (shown: number, total: number) =>
    `Les ${shown} rendez-vous les plus récents sur ${total} sont affichés.`,
} as const;

interface PatientAppointmentsProps {
  patient: PatientGetOne;
}

/**
 * The dossier's «Rendez-vous» tab: the patient's bookings from
 * `appointments.getManyByPatient` (newest first, capped server-side),
 * prefetched by the dossier page. Cancelled and no-show rows stay, muted: they
 * are history.
 *
 * A row opens the shared edit dialog — not the agenda's sheet. Every
 * appointments mutation invalidates the whole appointments router, so this
 * tab, the agenda and the list refresh together.
 */
const PatientAppointments = ({ patient }: PatientAppointmentsProps) => {
  const trpc = useTRPC();
  const { data, dataUpdatedAt } = useSuspenseQuery(
    trpc.appointments.getManyByPatient.queryOptions({ patientId: patient.id }),
  );

  // Dialog state, not page state: which dialog is open, for which row.
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<AppointmentByPatientItem | null>(null);

  // Split at the moment the data was fetched — pure, unlike reading the clock
  // during render. A booking that starts while the tab is open moves to
  // «Passés» on the next refetch (focus, or any appointment mutation).
  const now = dataUpdatedAt;
  const upcoming = data.items
    .filter((item) => item.startsAt.getTime() >= now)
    .reverse(); // the server sends newest first; soonest first here
  const past = data.items.filter((item) => item.startsAt.getTime() < now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button size="lg" onClick={() => setIsCreating(true)}>
          <PlusIcon />
          {COPY.newAppointment}
        </Button>
      </div>

      {data.items.length === 0 ? (
        <div className="py-6">
          <EmptyState title={COPY.empty} description={COPY.emptyDescription} />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <AppointmentGroup
              title={COPY.upcoming}
              items={upcoming}
              onOpen={setEditing}
            />
          )}
          {past.length > 0 && (
            <AppointmentGroup
              title={COPY.past}
              items={past}
              onOpen={setEditing}
            />
          )}
          {data.total > data.items.length && (
            <p className="text-muted-foreground text-sm">
              {COPY.truncated(data.items.length, data.total)}
            </p>
          )}
        </>
      )}

      <NewAppointmentDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        defaultValues={{ patient }}
        lockPatient
      />

      {editing && (
        <UpdateAppointmentDialog
          // A different row is a different booking: fresh form state.
          key={editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          initialValues={editing}
        />
      )}
    </div>
  );
};

interface AppointmentGroupProps {
  title: string;
  items: AppointmentByPatientItem[];
  onOpen: (item: AppointmentByPatientItem) => void;
}

const AppointmentGroup = ({ title, items, onOpen }: AppointmentGroupProps) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-muted-foreground text-sm font-medium">
      {title} · {items.length}
    </h3>
    <ul className="divide-border flex flex-col divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id}>
          <AppointmentRow item={item} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  </section>
);

/** History that no longer holds a slot: shown, but quieter. */
const MUTED_STATUSES: readonly string[] = [
  AppointmentStatus.Canceled,
  AppointmentStatus.NoShow,
];

const AppointmentRow = ({
  item,
  onOpen,
}: {
  item: AppointmentByPatientItem;
  onOpen: (item: AppointmentByPatientItem) => void;
}) => {
  const status = item.status as AppointmentStatus;
  const muted = MUTED_STATUSES.includes(status);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "hover:bg-muted/50 focus-visible:ring-ring/50 grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm outline-none focus-visible:ring-3 md:grid-cols-[6.5rem_9rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]",
        muted && "text-muted-foreground",
      )}
    >
      {/* Read on the clinic's wall clock; see the list's columns for why the
          leaves suppress the hydration warning. */}
      <span suppressHydrationWarning className="font-medium tabular-nums">
        {formatDate(item.startsAt)}
      </span>
      <span suppressHydrationWarning className="tabular-nums">
        {formatTime(item.startsAt)} – {formatTime(item.endsAt)}
      </span>
      <span className="col-span-3 flex min-w-0 items-center gap-2 md:col-span-1">
        {item.type ? (
          <>
            {/* The colour is data — the palette value stored on the type. */}
            <span
              aria-hidden="true"
              style={{ "--type-color": item.type.color } as CSSProperties}
              className={cn(
                "size-2.5 shrink-0 rounded-full bg-[var(--type-color)]",
                muted && "opacity-50",
              )}
            />
            <span className="truncate">{item.type.label}</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {APPOINTMENT_COPY.noType}
          </span>
        )}
      </span>
      <span className="col-span-3 truncate md:col-span-1">
        {item.practitioner?.name ?? (
          <span className="text-muted-foreground">
            {APPOINTMENT_COPY.noPractitioner}
          </span>
        )}
      </span>
      <span
        title={item.reason ?? undefined}
        className="text-muted-foreground col-span-3 truncate md:col-span-1"
      >
        {item.reason ?? APPOINTMENT_COPY.emptyField}
      </span>
      {/* Last on a wide row; on a phone it sits at the end of the first line,
          beside the date and time. */}
      <span className="col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
        <StatusBadge
          label={APPOINTMENT_STATUS_LABELS[status]}
          tone={APPOINTMENT_STATUS_TONES[status]}
        />
      </span>
    </button>
  );
};

export default PatientAppointments;
