"use client";

import {
  addHours,
  differenceInMinutes,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfWeek,
  getHours,
  getMinutes,
  isBefore,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import type React from "react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { WEEK_STARTS_ON } from "@/constants";

import { CALENDAR_COPY, WeekCellsHeight } from "./constants";
import { DraggableEvent } from "./draggable-event";
import { DroppableCell } from "./droppable-cell";
import { EventItem } from "./event-item";
import { formatCalendarDate, formatCalendarTime } from "./format";
import type { CalendarEvent } from "./types";
import { useCurrentTimeIndicator } from "./use-current-time-indicator";
import {
  assignOverlapLanes,
  getVisibleHourRange,
  isMultiDayEvent,
} from "./utils";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
  onEventCreate: (startTime: Date) => void;
}

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  zIndex: number;
}

export function WeekView({
  currentDate,
  events,
  onEventSelect,
  onEventCreate,
}: WeekViewProps) {
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, {
      weekStartsOn: WEEK_STARTS_ON,
    });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ end: weekEnd, start: weekStart });
  }, [currentDate]);

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON }),
    [currentDate],
  );

  // The clinic day, widened to any timed event outside it.
  const { startHour: gridStartHour, endHour: gridEndHour } = useMemo(
    () => getVisibleHourRange(events, days),
    [events, days],
  );

  const hours = useMemo(() => {
    const dayStart = startOfDay(currentDate);
    return eachHourOfInterval({
      end: addHours(dayStart, gridEndHour - 1),
      start: addHours(dayStart, gridStartHour),
    });
  }, [currentDate, gridStartHour, gridEndHour]);

  // Get all-day events and multi-day events for the week
  const allDayEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Include explicitly marked all-day events or multi-day events
        return event.allDay || isMultiDayEvent(event);
      })
      .filter((event) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return days.some(
          (day) =>
            isSameDay(day, eventStart) ||
            isSameDay(day, eventEnd) ||
            (day > eventStart && day < eventEnd),
        );
      });
  }, [events, days]);

  // Process events for each day to calculate positions
  const processedDayEvents = useMemo(() => {
    const result = days.map((day) => {
      // Get events for this day that are not all-day events or multi-day events
      const dayEvents = events.filter((event) => {
        // Skip all-day events and multi-day events
        if (event.allDay || isMultiDayEvent(event)) return false;

        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Check if event is on this day
        return (
          isSameDay(day, eventStart) ||
          isSameDay(day, eventEnd) ||
          (eventStart < day && eventEnd > day)
        );
      });

      // Sort events by start time and duration
      const sortedEvents = [...dayEvents].sort((a, b) => {
        const aStart = new Date(a.start);
        const bStart = new Date(b.start);
        const aEnd = new Date(a.end);
        const bEnd = new Date(b.end);

        // First sort by start time
        if (aStart < bStart) return -1;
        if (aStart > bStart) return 1;

        // If start times are equal, sort by duration (longer events first)
        const aDuration = differenceInMinutes(aEnd, aStart);
        const bDuration = differenceInMinutes(bEnd, bStart);
        return bDuration - aDuration;
      });

      // Clip to this day, then lay overlapping events side by side: each
      // cluster of overlaps splits the column width evenly between its lanes.
      const dayStart = startOfDay(day);
      const spans = sortedEvents.map((event) => ({
        end: isSameDay(day, event.end)
          ? new Date(event.end)
          : addHours(dayStart, 24),
        event,
        start: isSameDay(day, event.start) ? new Date(event.start) : dayStart,
      }));
      const lanes = assignOverlapLanes(spans);

      const positionedEvents: PositionedEvent[] = spans.map(
        ({ event, start, end }, index) => {
          const startHour = getHours(start) + getMinutes(start) / 60;
          const endHour = getHours(end) + getMinutes(end) / 60;
          const { lane, lanes: laneCount } = lanes[index];

          return {
            event,
            height: (endHour - startHour) * WeekCellsHeight,
            left: lane / laneCount,
            top: (startHour - gridStartHour) * WeekCellsHeight,
            width: 1 / laneCount,
            zIndex: 10 + lane,
          };
        },
      );

      return positionedEvents;
    });

    return result;
  }, [days, events, gridStartHour]);

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    onEventSelect(event);
  };

  const showAllDaySection = allDayEvents.length > 0;
  const { currentTimePosition, currentTimeVisible } = useCurrentTimeIndicator(
    currentDate,
    "week",
    gridStartHour,
    gridEndHour,
  );

  return (
    <div className="flex h-full flex-col" data-slot="week-view">
      <div className="border-border/70 bg-background/80 sticky top-0 z-30 grid grid-cols-8 border-b backdrop-blur-md">
        {/* Gutter corner, empty: upstream printed the viewer's GMT offset. */}
        <div />

        {days.map((day) => (
          <div
            className="text-muted-foreground/70 data-today:text-foreground py-2 text-center text-sm data-today:font-medium"
            data-today={isToday(day) || undefined}
            key={day.toString()}
          >
            <span aria-hidden="true" className="sm:hidden">
              {formatCalendarDate(day, "EEEEE")} {formatCalendarDate(day, "d")}
            </span>
            <span className="max-sm:hidden">
              {formatCalendarDate(day, "EEE dd")}
            </span>
          </div>
        ))}
      </div>

      {showAllDaySection && (
        <div className="border-border/70 bg-muted/50 border-b">
          <div className="grid grid-cols-8">
            <div className="border-border/70 relative border-r">
              <span className="text-muted-foreground/70 absolute bottom-0 left-0 h-6 w-16 max-w-full pe-2 text-right text-[10px] sm:pe-4 sm:text-xs">
                {CALENDAR_COPY.allDay}
              </span>
            </div>
            {days.map((day, dayIndex) => {
              const dayAllDayEvents = allDayEvents.filter((event) => {
                const eventStart = new Date(event.start);
                const eventEnd = new Date(event.end);
                return (
                  isSameDay(day, eventStart) ||
                  (day > eventStart && day < eventEnd) ||
                  isSameDay(day, eventEnd)
                );
              });

              return (
                <div
                  className="border-border/70 relative border-r p-1 last:border-r-0"
                  data-today={isToday(day) || undefined}
                  key={day.toString()}
                >
                  {dayAllDayEvents.map((event) => {
                    const eventStart = new Date(event.start);
                    const eventEnd = new Date(event.end);
                    const isFirstDay = isSameDay(day, eventStart);
                    const isLastDay = isSameDay(day, eventEnd);

                    // Check if this is the first day in the current week view
                    const isFirstVisibleDay =
                      dayIndex === 0 && isBefore(eventStart, weekStart);
                    const shouldShowTitle = isFirstDay || isFirstVisibleDay;

                    return (
                      <EventItem
                        event={event}
                        isFirstDay={isFirstDay}
                        isLastDay={isLastDay}
                        key={`spanning-${event.id}`}
                        onClick={(e) => handleEventClick(event, e)}
                        view="month"
                      >
                        {/* Show title if it's the first day of the event or the first visible day in the week */}
                        <div
                          aria-hidden={!shouldShowTitle}
                          className={cn(
                            "truncate",
                            !shouldShowTitle && "invisible",
                          )}
                        >
                          {event.title}
                        </div>
                      </EventItem>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-8 overflow-hidden">
        <div className="border-border/70 grid auto-cols-fr border-r">
          {hours.map((hour, index) => (
            <div
              className="border-border/70 relative min-h-[var(--week-cells-height)] border-b last:border-b-0"
              key={hour.toString()}
            >
              {index > 0 && (
                <span className="bg-background text-muted-foreground/70 absolute -top-3 left-0 flex h-6 w-16 max-w-full items-center justify-end pe-2 text-[10px] sm:pe-4 sm:text-xs">
                  {formatCalendarTime(hour)}
                </span>
              )}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            className="border-border/70 relative grid auto-cols-fr border-r last:border-r-0"
            data-today={isToday(day) || undefined}
            key={day.toString()}
          >
            {/* Positioned events */}
            {(processedDayEvents[dayIndex] ?? []).map((positionedEvent) => (
              <div
                className="absolute z-10 px-0.5"
                key={positionedEvent.event.id}
                onClick={(e) => e.stopPropagation()}
                style={{
                  height: `${positionedEvent.height}px`,
                  left: `${positionedEvent.left * 100}%`,
                  top: `${positionedEvent.top}px`,
                  width: `${positionedEvent.width * 100}%`,
                  zIndex: positionedEvent.zIndex,
                }}
              >
                <div className="size-full">
                  <DraggableEvent
                    event={positionedEvent.event}
                    height={positionedEvent.height}
                    onClick={(e) => handleEventClick(positionedEvent.event, e)}
                    showTime
                    view="week"
                  />
                </div>
              </div>
            ))}

            {/* Current time indicator - only show for today's column */}
            {currentTimeVisible && isToday(day) && (
              <div
                className="pointer-events-none absolute right-0 left-0 z-20"
                style={{ top: `${currentTimePosition}%` }}
              >
                <div className="relative flex items-center">
                  <div className="bg-primary absolute -left-1 h-2 w-2 rounded-full" />
                  <div className="bg-primary h-[2px] w-full" />
                </div>
              </div>
            )}
            {hours.map((hour) => {
              const hourValue = getHours(hour);
              return (
                <div
                  className="border-border/70 relative min-h-[var(--week-cells-height)] border-b last:border-b-0"
                  key={hour.toString()}
                >
                  {/* Quarter-hour intervals */}
                  {[0, 1, 2, 3].map((quarter) => {
                    const quarterHourTime = hourValue + quarter * 0.25;
                    return (
                      <DroppableCell
                        className={cn(
                          "absolute h-[calc(var(--week-cells-height)/4)] w-full",
                          quarter === 0 && "top-0",
                          quarter === 1 &&
                            "top-[calc(var(--week-cells-height)/4)]",
                          quarter === 2 &&
                            "top-[calc(var(--week-cells-height)/4*2)]",
                          quarter === 3 &&
                            "top-[calc(var(--week-cells-height)/4*3)]",
                        )}
                        date={day}
                        id={`week-cell-${day.toISOString()}-${quarterHourTime}`}
                        key={`${hour.toString()}-${quarter}`}
                        onClick={() => {
                          const startTime = new Date(day);
                          startTime.setHours(hourValue);
                          startTime.setMinutes(quarter * 15);
                          onEventCreate(startTime);
                        }}
                        time={quarterHourTime}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
