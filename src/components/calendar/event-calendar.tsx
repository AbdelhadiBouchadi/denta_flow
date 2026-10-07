"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  isSameMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CalendarCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WEEK_STARTS_ON } from "@/constants";
import { cn } from "@/lib/utils";

import { AgendaView } from "./agenda-view";
import { CalendarDndProvider } from "./calendar-dnd-context";
import {
  AgendaDaysToShow,
  CALENDAR_COPY,
  EventGap,
  EventHeight,
  VIEW_LABELS,
  VIEW_SHORTCUTS,
  WeekCellsHeight,
} from "./constants";
import { DayView } from "./day-view";
import { EventDialog } from "./event-dialog";
import { capitalize, formatCalendarDate } from "./format";
import { MonthView } from "./month-view";
import type { CalendarEvent, CalendarView } from "./types";
import { addHoursToDate } from "./utils";
import { WeekView } from "./week-view";

const VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];

/**
 * What `renderDialog` receives. `event` is `null` for the header's «Nouveau»
 * button, a draft with `id: ""` for an empty-slot click (start snapped to 15
 * minutes), and a real event when one was clicked.
 */
export interface CalendarDialogState {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

export interface EventCalendarProps {
  events?: CalendarEvent[];
  /** The calendar never invents an id — the server assigns one. */
  onEventAdd?: (event: Omit<CalendarEvent, "id">) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
  className?: string;
  /** Seeds the uncontrolled view. Ignored when `view` is passed. */
  initialView?: CalendarView;
  /** Controlled date. Omit to let the calendar own it. */
  date?: Date;
  onDateChange?: (date: Date) => void;
  /** Controlled view. Omit to let the calendar own it. */
  view?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** m/s/j/a switch views. Off by default: window-level listeners. */
  enableShortcuts?: boolean;
  /** Replaces the built-in EventDialog. */
  renderDialog?: (state: CalendarDialogState) => ReactNode;
}

export function EventCalendar({
  events = [],
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  className,
  initialView = "month",
  date: dateProp,
  onDateChange,
  view: viewProp,
  onViewChange,
  enableShortcuts = false,
  renderDialog,
}: EventCalendarProps) {
  // Controlled when the prop is passed, internal state otherwise. Every
  // internal mutation goes through these two setters.
  const [internalDate, setInternalDate] = useState(() => new Date());
  const [internalView, setInternalView] = useState<CalendarView>(initialView);
  const currentDate = dateProp ?? internalDate;
  const view = viewProp ?? internalView;

  const setCurrentDate = useCallback(
    (next: Date) => {
      if (dateProp === undefined) setInternalDate(next);
      onDateChange?.(next);
    },
    [dateProp, onDateChange],
  );

  const setView = useCallback(
    (next: CalendarView) => {
      if (viewProp === undefined) setInternalView(next);
      onViewChange?.(next);
    },
    [viewProp, onViewChange],
  );

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  // Keyboard shortcuts for view switching — opt-in only
  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea or contentEditable element,
      // if a modifier is held (Ctrl+A is "select all"), or if the dialog is open
      if (
        isEventDialogOpen ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const next = VIEWS.find(
        (candidate) =>
          VIEW_SHORTCUTS[candidate].toLowerCase() === e.key.toLowerCase(),
      );
      if (next) setView(next);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableShortcuts, isEventDialogOpen, setView]);

  const handlePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (view === "agenda") {
      // For agenda view, go back 30 days (a full month)
      setCurrentDate(addDays(currentDate, -AgendaDaysToShow));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (view === "agenda") {
      // For agenda view, go forward 30 days (a full month)
      setCurrentDate(addDays(currentDate, AgendaDaysToShow));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleEventCreate = (startTime: Date) => {
    // Snap to 15-minute intervals
    const minutes = startTime.getMinutes();
    const remainder = minutes % 15;
    if (remainder !== 0) {
      if (remainder < 7.5) {
        // Round down to nearest 15 min
        startTime.setMinutes(minutes - remainder);
      } else {
        // Round up to nearest 15 min
        startTime.setMinutes(minutes + (15 - remainder));
      }
      startTime.setSeconds(0);
      startTime.setMilliseconds(0);
    }

    const newEvent: CalendarEvent = {
      allDay: false,
      end: addHoursToDate(startTime, 1),
      id: "",
      start: startTime,
      title: "",
    };
    setSelectedEvent(newEvent);
    setIsEventDialogOpen(true);
  };

  const closeDialog = () => {
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
  };

  // No toasts here: the parent's mutation reports success or failure.
  const handleEventSave = (event: CalendarEvent) => {
    const { id, ...draft } = event;
    if (id) {
      onEventUpdate?.(event);
    } else {
      onEventAdd?.(draft);
    }
    closeDialog();
  };

  const handleEventDelete = (eventId: string) => {
    onEventDelete?.(eventId);
    closeDialog();
  };

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    onEventUpdate?.(updatedEvent);
  };

  const viewTitle = useMemo(() => {
    if (view === "month") {
      return capitalize(formatCalendarDate(currentDate, "MMMM yyyy"));
    }
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
      const end = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
      if (isSameMonth(start, end)) {
        return capitalize(formatCalendarDate(start, "MMMM yyyy"));
      }
      return capitalize(
        `${formatCalendarDate(start, "MMM")} – ${formatCalendarDate(end, "MMM yyyy")}`,
      );
    }
    if (view === "day") {
      return (
        <>
          <span aria-hidden="true" className="min-[480px]:hidden">
            {formatCalendarDate(currentDate, "d MMM yyyy")}
          </span>
          <span aria-hidden="true" className="max-[479px]:hidden min-md:hidden">
            {formatCalendarDate(currentDate, "d MMMM yyyy")}
          </span>
          <span className="max-md:hidden">
            {capitalize(formatCalendarDate(currentDate, "EEEE d MMMM yyyy"))}
          </span>
        </>
      );
    }
    if (view === "agenda") {
      // Show the month range for agenda view
      const start = currentDate;
      const end = addDays(currentDate, AgendaDaysToShow - 1);

      if (isSameMonth(start, end)) {
        return capitalize(formatCalendarDate(start, "MMMM yyyy"));
      }
      return capitalize(
        `${formatCalendarDate(start, "MMM")} – ${formatCalendarDate(end, "MMM yyyy")}`,
      );
    }
    return capitalize(formatCalendarDate(currentDate, "MMMM yyyy"));
  }, [currentDate, view]);

  const dialogState: CalendarDialogState = {
    event: selectedEvent,
    isOpen: isEventDialogOpen,
    onClose: closeDialog,
    onDelete: handleEventDelete,
    onSave: handleEventSave,
  };

  return (
    <div
      className="flex flex-col rounded-lg border has-data-[slot=month-view]:flex-1"
      style={
        {
          "--event-gap": `${EventGap}px`,
          "--event-height": `${EventHeight}px`,
          "--week-cells-height": `${WeekCellsHeight}px`,
        } as React.CSSProperties
      }
    >
      <CalendarDndProvider onEventUpdate={handleEventUpdate}>
        <div
          className={cn(
            "flex items-center justify-between p-2 sm:p-4",
            className,
          )}
        >
          <div className="flex items-center gap-1 sm:gap-4">
            <Button
              className="max-[479px]:aspect-square max-[479px]:p-0!"
              onClick={handleToday}
              variant="outline"
            >
              <CalendarCheckIcon
                aria-hidden="true"
                className="min-[480px]:hidden"
                size={16}
              />
              <span className="max-[479px]:sr-only">{CALENDAR_COPY.today}</span>
            </Button>
            <div className="flex items-center sm:gap-2">
              <Button
                aria-label={CALENDAR_COPY.previous}
                onClick={handlePrevious}
                size="icon"
                variant="ghost"
              >
                <ChevronLeftIcon aria-hidden="true" size={16} />
              </Button>
              <Button
                aria-label={CALENDAR_COPY.next}
                onClick={handleNext}
                size="icon"
                variant="ghost"
              >
                <ChevronRightIcon aria-hidden="true" size={16} />
              </Button>
            </div>
            <h2 className="text-sm font-semibold sm:text-lg md:text-xl">
              {viewTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="gap-1.5 max-[479px]:h-8"
                    variant="outline"
                  />
                }
              >
                <span>
                  <span aria-hidden="true" className="min-[480px]:hidden">
                    {VIEW_LABELS[view].charAt(0)}
                  </span>
                  <span className="max-[479px]:sr-only">
                    {VIEW_LABELS[view]}
                  </span>
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="-me-1 opacity-60"
                  size={16}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-32">
                {VIEWS.map((candidate) => (
                  <DropdownMenuItem
                    key={candidate}
                    onClick={() => setView(candidate)}
                  >
                    {VIEW_LABELS[candidate]}
                    {enableShortcuts && (
                      <DropdownMenuShortcut>
                        {VIEW_SHORTCUTS[candidate]}
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="max-[479px]:aspect-square max-[479px]:p-0!"
              onClick={() => {
                setSelectedEvent(null); // Ensure we're creating a new event
                setIsEventDialogOpen(true);
              }}
              size="sm"
            >
              <PlusIcon
                aria-hidden="true"
                className="opacity-60 sm:-ms-1"
                size={16}
              />
              <span className="max-sm:sr-only">{CALENDAR_COPY.newEvent}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventCreate={handleEventCreate}
              onEventSelect={handleEventSelect}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventCreate={handleEventCreate}
              onEventSelect={handleEventSelect}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventCreate={handleEventCreate}
              onEventSelect={handleEventSelect}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
            />
          )}
        </div>

        {renderDialog ? (
          renderDialog(dialogState)
        ) : (
          <EventDialog
            event={selectedEvent}
            isOpen={isEventDialogOpen}
            onClose={closeDialog}
            onDelete={handleEventDelete}
            onSave={handleEventSave}
          />
        )}
      </CalendarDndProvider>
    </div>
  );
}
