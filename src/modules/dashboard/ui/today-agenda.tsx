import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRightIcon } from "lucide-react";

import EmptyState from "@/components/shared/empty-state";
import MedicalAlertBadge from "@/components/shared/medical-alert-badge";
import StatusBadge from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DASHBOARD_COPY as COPY, durationLabel } from "../constants";
import type { DashboardAppointment } from "../types";
import { AppointmentStatusControl } from "./appointment-status-control";

interface TodayAgendaProps {
  appointments: DashboardAppointment[];
  className?: string;
}

/**
 * «Rendez-vous d’aujourd’hui», in start order. A list, not a table: at 390 px
 * each row folds into two lines (time + status, then patient · praticien)
 * instead of scrolling sideways.
 */
export const TodayAgenda = ({ appointments, className }: TodayAgendaProps) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="text-h4">{COPY.agendaTitle}</CardTitle>
      <CardAction>
        <Link
          href="/calendrier"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {COPY.agendaLink}
          <ArrowRightIcon />
        </Link>
      </CardAction>
    </CardHeader>
    <CardContent>
      {appointments.length === 0 ? (
        <div className="py-8">
          <EmptyState
            title={COPY.agendaEmpty}
            description={COPY.agendaEmptyHint}
          />
        </div>
      ) : (
        <ul className="divide-border -my-2 divide-y">
          {appointments.map((appointment) => (
            <AgendaRow key={appointment.id} appointment={appointment} />
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

const AgendaRow = ({ appointment }: { appointment: DashboardAppointment }) => {
  const { type, practitioner, patient } = appointment;

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center">
      {/* Read on the clinic's wall clock; see the appointments list for the
          hydration note. */}
      <div className="flex flex-col tabular-nums sm:row-span-1">
        <span suppressHydrationWarning className="text-foreground font-medium">
          {formatTime(appointment.startsAt)}
        </span>
        <span className="text-muted-foreground text-xs">
          {durationLabel(appointment.durationMinutes)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/patients/${patient.id}`}
            className="text-foreground truncate font-medium hover:underline"
          >
            {patient.name}
          </Link>
          <MedicalAlertBadge compact active={appointment.hasMedicalAlert} />
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
            {patient.shortCode}
          </span>
          {appointment.isLate && (
            <StatusBadge label={COPY.late} tone="warning" />
          )}
        </div>
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            {/* The colour is data — the palette value stored on the type. */}
            <span
              aria-hidden="true"
              style={
                type?.color
                  ? ({ "--type-color": type.color } as CSSProperties)
                  : undefined
              }
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                type?.color ? "bg-[var(--type-color)]" : "bg-muted-foreground",
              )}
            />
            <span className="truncate">{type?.label ?? COPY.noType}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {practitioner?.name ?? COPY.noPractitioner}
          </span>
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <AppointmentStatusControl
          appointmentId={appointment.id}
          status={appointment.status}
        />
      </div>
    </li>
  );
};
