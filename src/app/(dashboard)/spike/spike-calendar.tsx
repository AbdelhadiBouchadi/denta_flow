"use client";

// THROWAWAY — branch 17 spike (prompts/17-calendar-spike.md). Delete this
// folder before the branch's last commit. Hardcoded events, no real data.
// Client half of the spike: `ssr: false` is only allowed in a Client Component.

import { differenceInMinutes, format } from "date-fns";
import { fr } from "date-fns/locale";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import type {
  CalendarDialogState,
  CalendarEvent,
  CalendarView,
} from "@/components/calendar";
import { Button } from "@/components/ui/button";
import { AGENDA_DAY_END, AGENDA_DAY_START } from "@/constants";

// Patch 14: client-only at the boundary — `useState(new Date())` and an
// unguarded `useLayoutEffect` live inside.
const EventCalendar = dynamic(
  () => import("@/components/calendar").then((mod) => mod.EventCalendar),
  { ssr: false },
);

const at = (day: number, hours: number, minutes = 0, month = 0) =>
  new Date(2026, month, day, hours, minutes);

const SEED_EVENTS: CalendarEvent[] = [
  // All-day
  {
    id: "all-day",
    title: "Formation continue",
    start: at(14, 0),
    end: at(14, 23, 59),
    allDay: true,
    color: "violet",
  },
  // Multi-day 15 Jan → 15 Feb (same day-of-month: the isMultiDayEvent bug)
  {
    id: "multi-day",
    title: "Congé Dr Alaoui",
    start: at(15, 9),
    end: at(15, 17, 0, 1),
    color: "rose",
  },
  // Three overlapping in one hour
  {
    id: "overlap-1",
    title: "Détartrage",
    start: at(13, 10),
    end: at(13, 11),
    color: "sky",
  },
  {
    id: "overlap-2",
    title: "Consultation",
    start: at(13, 10, 15),
    end: at(13, 10, 45),
    color: "amber",
  },
  {
    id: "overlap-3",
    title: "Radio panoramique",
    start: at(13, 10, 30),
    end: at(13, 11),
    color: "emerald",
  },
  // Outside the clinic grid (08:00–20:00)
  {
    id: "early",
    title: "Urgence 07 h 30",
    start: at(12, 7, 30),
    end: at(12, 8, 15),
    color: "orange",
  },
  {
    id: "late",
    title: "Urgence 20 h 30",
    start: at(16, 20, 30),
    end: at(16, 21, 15),
    color: "orange",
  },
  // Five minutes long
  {
    id: "five-min",
    title: "Contrôle 5 min",
    start: at(14, 11),
    end: at(14, 11, 5),
    color: "sky",
  },
  // A normal week
  {
    id: "w-1",
    title: "Extraction 36",
    start: at(12, 9),
    end: at(12, 10),
    color: "rose",
  },
  {
    id: "w-2",
    title: "Couronne 11",
    start: at(12, 14),
    end: at(12, 15, 30),
    color: "violet",
  },
  {
    id: "w-3",
    title: "Blanchiment",
    start: at(13, 15),
    end: at(13, 16),
    color: "emerald",
  },
  {
    id: "w-4",
    title: "Soins carie 46",
    start: at(14, 9, 30),
    end: at(14, 10, 15),
    color: "amber",
  },
  {
    id: "w-5",
    title: "Pose implant",
    start: at(14, 14),
    end: at(14, 16),
    color: "violet",
  },
  {
    id: "w-6",
    title: "Bilan orthodontie",
    start: at(16, 11),
    end: at(16, 11, 45),
    color: "sky",
  },
  {
    id: "w-7",
    title: "Prothèse amovible",
    start: at(17, 10),
    end: at(17, 11),
    color: "amber",
  },
  // Elsewhere in the month
  {
    id: "m-1",
    title: "Première consultation",
    start: at(5, 9),
    end: at(5, 9, 30),
    color: "sky",
  },
  {
    id: "m-2",
    title: "Suivi parodontal",
    start: at(21, 16),
    end: at(21, 17),
    color: "emerald",
  },
  {
    id: "m-3",
    title: "Dévitalisation 26",
    start: at(28, 10),
    end: at(28, 11, 30),
    color: "rose",
  },
  // UTC instants: their wall-clock time must follow the browser's TZ
  {
    id: "utc-1",
    title: "Instant UTC 09:00Z",
    start: new Date("2026-01-16T09:00:00Z"),
    end: new Date("2026-01-16T09:45:00Z"),
    color: "orange",
  },
  {
    id: "utc-2",
    title: "Instant UTC 15:30Z",
    start: new Date("2026-01-15T15:30:00Z"),
    end: new Date("2026-01-15T16:00:00Z"),
    color: "amber",
  },
];

const VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];

const stamp = (date: Date) =>
  format(date, "EEE d MMM yyyy HH:mm", { locale: fr });

const subscribeNoop = () => () => {};

export function SpikeCalendar() {
  // TZ-dependent text below: render on the client only, no hydration mismatch.
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const [events, setEvents] = useState(SEED_EVENTS);
  const [date, setDate] = useState(() => new Date(2026, 0, 14));
  const [view, setView] = useState<CalendarView>("week");
  const [enableShortcuts, setEnableShortcuts] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const report = (line: string) =>
    setLog((previous) => [line, ...previous].slice(0, 30));

  // Stands in for "mutation + invalidate": the calendar keeps no copy.
  const handleEventUpdate = (updated: CalendarEvent) => {
    const original = events.find((event) => event.id === updated.id);
    if (original) {
      const before = differenceInMinutes(original.end, original.start);
      const after = differenceInMinutes(updated.end, updated.start);
      report(
        `DÉPLACÉ « ${updated.title} » : ${stamp(original.start)} → ${stamp(updated.start)} · durée ${before} → ${after} min ${before === after ? "✓" : "✗"}`,
      );
    }
    setEvents((previous) =>
      previous.map((event) => (event.id === updated.id ? updated : event)),
    );
  };

  const renderDialog = ({ event, isOpen, onClose }: CalendarDialogState) => {
    if (!isOpen) return null;

    let description = "Bouton « Nouveau » (aucun créneau)";
    if (event?.id) {
      description = `Rendez-vous cliqué : « ${event.title} » ${stamp(event.start)}`;
    } else if (event) {
      const snapped = event.start.getMinutes() % 15 === 0;
      description = `Créneau vide : début ${stamp(event.start)} ${snapped ? "(calé sur 15 min ✓)" : "(non calé ✗)"}`;
    }

    return (
      <div className="bg-muted m-2 flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
        <span>
          <strong>renderDialog</strong> — {description}
        </span>
        <Button onClick={onClose} size="sm" variant="outline">
          Fermer
        </Button>
      </div>
    );
  };

  if (!isClient) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
        <strong>Contrôle externe :</strong>
        {VIEWS.map((candidate) => (
          <Button
            key={candidate}
            onClick={() => setView(candidate)}
            size="sm"
            variant={view === candidate ? "default" : "outline"}
          >
            {candidate}
          </Button>
        ))}
        <Button
          onClick={() => setDate(new Date(2026, 0, 14))}
          size="sm"
          variant="outline"
        >
          14 janv. 2026
        </Button>
        <Button
          onClick={() => setDate(new Date(2026, 1, 2))}
          size="sm"
          variant="outline"
        >
          2 févr. 2026
        </Button>
        <label className="flex items-center gap-1">
          <input
            checked={enableShortcuts}
            onChange={(e) => setEnableShortcuts(e.target.checked)}
            type="checkbox"
          />
          enableShortcuts
        </label>
        <span className="text-muted-foreground">
          état : view=<code>{view}</code> date=<code>{stamp(date)}</code> ·
          grille {AGENDA_DAY_START}–{AGENDA_DAY_END} · TZ navigateur{" "}
          <code>{Intl.DateTimeFormat().resolvedOptions().timeZone}</code>
        </span>
      </section>

      <EventCalendar
        date={date}
        enableShortcuts={enableShortcuts}
        events={events}
        onDateChange={(next) => {
          report(`onDateChange → ${stamp(next)}`);
          setDate(next);
        }}
        onEventUpdate={handleEventUpdate}
        onViewChange={(next) => {
          report(`onViewChange → ${next}`);
          setView(next);
        }}
        renderDialog={renderDialog}
        view={view}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-3 text-sm">
          <h2 className="mb-2 font-semibold">
            Journal (le plus récent en haut)
          </h2>
          {log.length === 0 ? (
            <p className="text-muted-foreground">Aucune interaction.</p>
          ) : (
            <ol className="space-y-1 font-mono text-xs">
              {log.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-md border p-3 text-sm">
          <h2 className="mb-2 font-semibold">
            Heure locale attendue de chaque événement
          </h2>
          <ul className="space-y-1 font-mono text-xs">
            {events.map((event) => (
              <li key={event.id}>
                {format(event.start, "dd/MM HH:mm")}–
                {format(event.end, "dd/MM HH:mm")} · {event.title}
                {event.allDay ? " (journée)" : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
