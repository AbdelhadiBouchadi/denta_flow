"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays } from "date-fns";
import { useState } from "react";

import { useCalendarDnd } from "./calendar-dnd-context";
import { EventItem } from "./event-item";
import type { CalendarEvent } from "./types";

interface DraggableEventProps {
  event: CalendarEvent;
  view: "month" | "week" | "day";
  showTime?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  height?: number;
  isMultiDay?: boolean;
  multiDayWidth?: number;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}

export function DraggableEvent({
  event,
  view,
  showTime,
  onClick,
  height,
  isMultiDay,
  multiDayWidth,
  isFirstDay = true,
  isLastDay = true,
  "aria-hidden": ariaHidden,
}: DraggableEventProps) {
  const { activeId } = useCalendarDnd();
  // Measured on pointer down, never read from a ref during render.
  const [dragHandlePosition, setDragHandlePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  // Check if this is a multi-day event
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);
  const isMultiDayEvent =
    isMultiDay || event.allDay || differenceInDays(eventEnd, eventStart) >= 1;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      data: {
        dragHandlePosition,
        event,
        height: height || measuredHeight,
        isFirstDay,
        isLastDay,
        isMultiDay: isMultiDayEvent,
        multiDayWidth: multiDayWidth,
        view,
      },
      id: `${event.id}-${view}`,
    });

  // Track where on the event the drag began, and its height, for the overlay.
  // Capture phase on the wrapper: dnd-kit's listeners on the inner button
  // would otherwise replace an onMouseDown passed down to it. Covers mouse,
  // touch and pen alike.
  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragHandlePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setMeasuredHeight(rect.height);
  };

  // Don't render if this event is being dragged
  if (isDragging || activeId === `${event.id}-${view}`) {
    return (
      <div
        className="opacity-0"
        ref={setNodeRef}
        style={{ height: height || "auto" }}
      />
    );
  }

  const style = transform
    ? {
        height: height || "auto",
        transform: CSS.Translate.toString(transform),
        width:
          isMultiDayEvent && multiDayWidth ? `${multiDayWidth}%` : undefined,
      }
    : {
        height: height || "auto",
        width:
          isMultiDayEvent && multiDayWidth ? `${multiDayWidth}%` : undefined,
      };

  return (
    <div
      className="touch-none"
      onPointerDownCapture={handlePointerDownCapture}
      ref={setNodeRef}
      style={style}
    >
      <EventItem
        aria-hidden={ariaHidden}
        dndAttributes={attributes}
        dndListeners={listeners}
        event={event}
        isDragging={isDragging}
        isFirstDay={isFirstDay}
        isLastDay={isLastDay}
        onClick={onClick}
        showTime={showTime}
        view={view}
      />
    </div>
  );
}
