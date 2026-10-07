"use client";

import {
  addHours,
  differenceInMinutes,
  eachHourOfInterval,
  getHours,
  getMinutes,
  isSameDay,
  startOfDay,
} from "date-fns";
import type React from "react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { CALENDAR_COPY, WeekCellsHeight } from "./constants";
import { DraggableEvent } from "./draggable-event";
import { DroppableCell } from "./droppable-cell";
import { EventItem } from "./event-item";
import { formatCalendarTime } from "./format";
import type { CalendarEvent } from "./types";
import { useCurrentTimeIndicator } from "./use-current-time-indicator";
import {
  assignOverlapLanes,
  getVisibleHourRange,
  isMultiDayEvent,
} from "./utils";

interface DayViewProps {
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

export function DayView({
  currentDate,
  events,
  onEventSelect,
  onEventCreate,
}: DayViewProps) {
  const dayEvents = useMemo(() => {
    return events
      .filter((event) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return (
          isSameDay(currentDate, eventStart) ||
          isSameDay(currentDate, eventEnd) ||
          (currentDate > eventStart && currentDate < eventEnd)
        );
      })
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
  }, [currentDate, events]);

  // The clinic day, widened to any timed event outside it.
  const { startHour: gridStartHour, endHour: gridEndHour } = useMemo(
    () => getVisibleHourRange(dayEvents, [currentDate]),
    [dayEvents, currentDate],
  );

  const hours = useMemo(() => {
    const dayStart = startOfDay(currentDate);
    return eachHourOfInterval({
      end: addHours(dayStart, gridEndHour - 1),
      start: addHours(dayStart, gridStartHour),
    });
  }, [currentDate, gridStartHour, gridEndHour]);

  // Filter all-day events
  const allDayEvents = useMemo(() => {
    return dayEvents.filter((event) => {
      // Include explicitly marked all-day events or multi-day events
      return event.allDay || isMultiDayEvent(event);
    });
  }, [dayEvents]);

  // Get only single-day time-based events
  const timeEvents = useMemo(() => {
    return dayEvents.filter((event) => {
      // Exclude all-day events and multi-day events
      return !event.allDay && !isMultiDayEvent(event);
    });
  }, [dayEvents]);

  // Process events to calculate positions
  const positionedEvents = useMemo(() => {
    const result: PositionedEvent[] = [];
    const dayStart = startOfDay(currentDate);

    // Sort events by start time and duration
    const sortedEvents = [...timeEvents].sort((a, b) => {
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

    // Clip to the day, then lay overlapping events side by side: each
    // cluster of overlaps splits the column width evenly between its lanes.
    const spans = sortedEvents.map((event) => ({
      end: isSameDay(currentDate, event.end)
        ? new Date(event.end)
        : addHours(dayStart, 24),
      event,
      start: isSameDay(currentDate, event.start)
        ? new Date(event.start)
        : dayStart,
    }));
    const lanes = assignOverlapLanes(spans);

    spans.forEach(({ event, start, end }, index) => {
      const startHour = getHours(start) + getMinutes(start) / 60;
      const endHour = getHours(end) + getMinutes(end) / 60;
      const { lane, lanes: laneCount } = lanes[index];

      result.push({
        event,
        height: (endHour - startHour) * WeekCellsHeight,
        left: lane / laneCount,
        top: (startHour - gridStartHour) * WeekCellsHeight,
        width: 1 / laneCount,
        zIndex: 10 + lane,
      });
    });

    return result;
  }, [currentDate, timeEvents, gridStartHour]);

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    onEventSelect(event);
  };

  const showAllDaySection = allDayEvents.length > 0;
  const { currentTimePosition, currentTimeVisible } = useCurrentTimeIndicator(
    currentDate,
    "day",
    gridStartHour,
    gridEndHour,
  );

  return (
    <div className="contents" data-slot="day-view">
      {showAllDaySection && (
        <div className="border-border/70 bg-muted/50 border-t">
          <div className="grid grid-cols-[3rem_1fr] sm:grid-cols-[4rem_1fr]">
            <div className="relative">
              <span className="text-muted-foreground/70 absolute bottom-0 left-0 h-6 w-16 max-w-full pe-2 text-right text-[10px] sm:pe-4 sm:text-xs">
                {CALENDAR_COPY.allDay}
              </span>
            </div>
            <div className="border-border/70 relative border-r p-1 last:border-r-0">
              {allDayEvents.map((event) => {
                const eventStart = new Date(event.start);
                const eventEnd = new Date(event.end);
                const isFirstDay = isSameDay(currentDate, eventStart);
                const isLastDay = isSameDay(currentDate, eventEnd);

                return (
                  <EventItem
                    event={event}
                    isFirstDay={isFirstDay}
                    isLastDay={isLastDay}
                    key={`spanning-${event.id}`}
                    onClick={(e) => handleEventClick(event, e)}
                    view="month"
                  >
                    {/* Always show the title in day view for better usability */}
                    <div>{event.title}</div>
                  </EventItem>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="border-border/70 grid flex-1 grid-cols-[3rem_1fr] overflow-hidden border-t sm:grid-cols-[4rem_1fr]">
        <div>
          {hours.map((hour, index) => (
            <div
              className="border-border/70 relative h-[var(--week-cells-height)] border-b last:border-b-0"
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

        <div className="relative">
          {/* Positioned events */}
          {positionedEvents.map((positionedEvent) => (
            <div
              className="absolute z-10 px-0.5"
              key={positionedEvent.event.id}
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
                  view="day"
                />
              </div>
            </div>
          ))}

          {/* Current time indicator */}
          {currentTimeVisible && (
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

          {/* Time grid */}
          {hours.map((hour) => {
            const hourValue = getHours(hour);
            return (
              <div
                className="border-border/70 relative h-[var(--week-cells-height)] border-b last:border-b-0"
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
                      date={currentDate}
                      id={`day-cell-${currentDate.toISOString()}-${quarterHourTime}`}
                      key={`${hour.toString()}-${quarter}`}
                      onClick={() => {
                        const startTime = new Date(currentDate);
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
      </div>
    </div>
  );
}
