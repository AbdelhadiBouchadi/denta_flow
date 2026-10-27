"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircleIcon } from "lucide-react";

import { formatCalendarDate } from "@/lib/format";
import { toClinicDate, toClinicWallClock } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_LABELS,
  SKIP_REASON_LABELS,
  STATUS_LABELS,
  WHATSAPP_COPY as COPY,
} from "../constants";
import {
  WhatsappMessageStatus,
  type WhatsappLatestMessage,
  type WhatsappSkipReason,
} from "../types";

/** «Rappel : Lu», «Rappel : Ignoré — pas de consentement», «Rappel : Planifié le 14/10 à 17:00». */
const describe = (message: NonNullable<WhatsappLatestMessage>) => {
  const event = EVENT_LABELS[message.event];
  if (message.status === WhatsappMessageStatus.Scheduled) {
    const day = formatCalendarDate(toClinicDate(message.scheduledFor)).slice(0, 5);
    return `${event} : ${COPY.latestPlannedAt(day, toClinicWallClock(message.scheduledFor))}`;
  }
  const status = STATUS_LABELS[message.status];
  const reason = message.skipReason
    ? ` — ${SKIP_REASON_LABELS[message.skipReason as WhatsappSkipReason]}`
    : "";
  return `${event} : ${status}${reason}`;
};

/**
 * A compact chip with the latest message about one appointment, wherever the
 * appointment's details open. A dialog's data, not a page's: plain
 * `useQuery`, and nothing at all while it loads or when there is no message
 * (04-hydration.md §4 rule 8).
 */
export const AppointmentMessageBadge = ({ appointmentId }: { appointmentId: string }) => {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.whatsapp.getLatestForAppointment.queryOptions({ appointmentId }),
  );
  if (!data) return null;

  return (
    <span className="text-muted-foreground inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
      <MessageCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate tabular-nums">{describe(data)}</span>
    </span>
  );
};
