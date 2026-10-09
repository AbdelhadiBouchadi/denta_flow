"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  APPOINTMENT_COPY,
  APPOINTMENT_STATUS_TOASTS,
  formatWaitingTime,
  WAITING_ROOM_COPY as COPY,
} from "../constants";
import { useInvalidateAppointments } from "../hooks/use-invalidate-appointments";
import { useWaitingRoom } from "../hooks/use-waiting-room";
import { AppointmentStatus, type WaitingRoomItem } from "../types";
import {
  WAITING_ROOM_REFRESH_MS,
  waitingMinutes,
  waitingTone,
  type WaitingTone,
} from "../waiting-room";

/** Tokens only: the thresholds live in `waiting-room.ts`. */
const TONE_CLASSES: Record<WaitingTone, string> = {
  normal: "text-muted-foreground",
  warning: "text-warning-strong",
  danger: "text-destructive",
};

/**
 * The browser's clock, re-read every `WAITING_ROOM_REFRESH_MS`. The list only
 * ever renders inside an open popover or drawer — never on the server — so
 * reading the clock here cannot cause a hydration mismatch.
 */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), WAITING_ROOM_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return now;
};

interface WaitingRoomListProps {
  /** Called when a link leaves for a dossier — the parent closes itself. */
  onNavigate?: () => void;
}

/**
 * «Salle d’attente»: who is waiting, since when, and one action — «Terminer».
 * A receptionist reads it all day: one dense row per patient, longest wait
 * first (the server's order), no amounts.
 *
 * Putting a patient back to planned or confirmed is a correction made from
 * the agenda, not from here (prompts/24, decision 4).
 */
export const WaitingRoomList = ({ onNavigate }: WaitingRoomListProps) => {
  const { data, isPending, isError, refetch } = useWaitingRoom();
  const now = useNow();

  if (isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Spinner className="size-4" />
        {COPY.loading}
      </p>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2 py-6 text-sm">
        <p className="text-muted-foreground">{COPY.error}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {COPY.retry}
        </Button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {COPY.empty}
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {data.items.map((item) => (
        <WaitingRoomRow
          key={item.id}
          item={item}
          now={now}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
};

interface WaitingRoomRowProps {
  item: WaitingRoomItem;
  now: Date;
  onNavigate?: () => void;
}

const WaitingRoomRow = ({ item, now, onNavigate }: WaitingRoomRowProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateAppointments();
  const { patient, type, practitioner } = item;

  // The appointments slice's one invalidation block: it refreshes this list,
  // the badge, the agenda and the dashboard together.
  const complete = useMutation(
    trpc.appointments.updateStatus.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(APPOINTMENT_STATUS_TOASTS[AppointmentStatus.Completed]);
      },
      onError: async (error) => {
        // CONFLICT: someone moved it first — show what is really stored.
        if (error.data?.code === "CONFLICT") await invalidateAll();
        toast.error(getErrorMessage(error));
      },
    }),
  );

  const minutes = waitingMinutes(item.arrivedAt, now);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/patients/${patient.id}`}
            onClick={onNavigate}
            className="text-foreground truncate font-medium hover:underline"
          >
            {patient.name}
          </Link>
          {item.hasMedicalAlert && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    aria-label={COPY.medicalAlert}
                    className="text-destructive inline-flex shrink-0"
                  />
                }
              >
                <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{COPY.medicalAlert}</TooltipContent>
            </Tooltip>
          )}
          <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
            {patient.shortCode}
          </span>
        </div>

        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
          <span className="tabular-nums">
            {COPY.appointmentAt} {formatTime(item.startsAt)}
          </span>
          <span aria-hidden="true">·</span>
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
                "size-2 shrink-0 rounded-full",
                type?.color ? "bg-[var(--type-color)]" : "bg-muted-foreground",
              )}
            />
            <span className="truncate">
              {type?.label ?? APPOINTMENT_COPY.noType}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {practitioner?.name ?? APPOINTMENT_COPY.noPractitioner}
          </span>
        </div>

        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            TONE_CLASSES[waitingTone(minutes)],
          )}
        >
          <ClockIcon className="size-3" aria-hidden="true" />
          {formatWaitingTime(minutes)}
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={complete.isPending}
        aria-label={`${COPY.completeLabel} ${patient.name}`}
        onClick={() =>
          complete.mutate({ id: item.id, status: AppointmentStatus.Completed })
        }
      >
        {complete.isPending ? <Spinner /> : <CheckIcon />}
        {COPY.complete}
      </Button>
    </li>
  );
};
