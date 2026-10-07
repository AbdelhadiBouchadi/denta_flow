"use client";

import { endOfWeek, isSameDay, isWithinInterval, startOfWeek } from "date-fns";
import { useEffect, useState } from "react";

import { WEEK_STARTS_ON } from "@/constants";

export function useCurrentTimeIndicator(
  currentDate: Date,
  view: "day" | "week",
  startHour: number,
  endHour: number,
) {
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);
  const [currentTimeVisible, setCurrentTimeVisible] = useState<boolean>(false);

  useEffect(() => {
    const calculateTimePosition = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = (hours - startHour) * 60 + minutes;
      const gridMinutes = (endHour - startHour) * 60;

      // Calculate position as percentage of the drawn grid
      const position = (totalMinutes / gridMinutes) * 100;

      // Check if current day is in view based on the calendar view
      let isCurrentTimeVisible = false;

      if (view === "day") {
        isCurrentTimeVisible = isSameDay(now, currentDate);
      } else if (view === "week") {
        const startOfWeekDate = startOfWeek(currentDate, {
          weekStartsOn: WEEK_STARTS_ON,
        });
        const endOfWeekDate = endOfWeek(currentDate, {
          weekStartsOn: WEEK_STARTS_ON,
        });
        isCurrentTimeVisible = isWithinInterval(now, {
          end: endOfWeekDate,
          start: startOfWeekDate,
        });
      }

      // The grid no longer spans 24 h: outside it, the line has nowhere to go.
      const isWithinGrid = position >= 0 && position <= 100;

      setCurrentTimePosition(position);
      setCurrentTimeVisible(isCurrentTimeVisible && isWithinGrid);
    };

    // Calculate immediately
    calculateTimePosition();

    // Update every minute
    const interval = setInterval(calculateTimePosition, 60000);

    return () => clearInterval(interval);
  }, [currentDate, view, startHour, endHour]);

  return { currentTimePosition, currentTimeVisible };
}
