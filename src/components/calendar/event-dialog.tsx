"use client";

import { isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  CALENDAR_COPY,
  DefaultEndHour,
  DefaultStartHour,
  EVENT_COLOR_LABELS,
} from "./constants";
import { formatCalendarDate, formatCalendarTime } from "./format";
import type { CalendarEvent, EventColor } from "./types";

// "HH:mm", padded to match the select's option values.
const DEFAULT_START_TIME = `${String(DefaultStartHour).padStart(2, "0")}:00`;
const DEFAULT_END_TIME = `${String(DefaultEndHour).padStart(2, "0")}:00`;

interface EventDialogProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

export function EventDialog({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [color, setColor] = useState<EventColor>("sky");
  const [error, setError] = useState<string | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setStartDate(new Date());
    setEndDate(new Date());
    setStartTime(DEFAULT_START_TIME);
    setEndTime(DEFAULT_END_TIME);
    setAllDay(false);
    setLocation("");
    setColor("sky");
    setError(null);
  }, []);

  const formatTimeForInput = useCallback((date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = Math.floor(date.getMinutes() / 15) * 15;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }, []);

  // Re-seed the form whenever a different event is handed in. Adjusting state
  // during render (React's documented pattern) rather than in an effect, which
  // would paint the stale form for one frame. `undefined` forces the first sync.
  const [syncedEvent, setSyncedEvent] = useState<
    CalendarEvent | null | undefined
  >(undefined);
  if (event !== syncedEvent) {
    setSyncedEvent(event);
    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");

      const start = new Date(event.start);
      const end = new Date(event.end);

      setStartDate(start);
      setEndDate(end);
      setStartTime(formatTimeForInput(start));
      setEndTime(formatTimeForInput(end));
      setAllDay(event.allDay || false);
      setLocation(event.location || "");
      setColor((event.color as EventColor) || "sky");
      setError(null); // Reset error when opening dialog
    } else {
      resetForm();
    }
  }

  // Memoize time options so they're only calculated once
  const timeOptions = useMemo(() => {
    const options = [];
    // The whole day: out-of-hours is a warning elsewhere, never a block here.
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, "0");
        const formattedMinute = minute.toString().padStart(2, "0");
        const value = `${formattedHour}:${formattedMinute}`;
        // Use a fixed date to avoid unnecessary date object creations
        const date = new Date(2000, 0, 1, hour, minute);
        const label = formatCalendarTime(date);
        options.push({ label, value });
      }
    }
    return options;
  }, []); // Empty dependency array ensures this only runs once

  const handleSave = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!allDay) {
      const [startHours = 0, startMinutes = 0] = startTime
        .split(":")
        .map(Number);
      const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);

      start.setHours(startHours, startMinutes, 0);
      end.setHours(endHours, endMinutes, 0);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    // Validate that end date is not before start date
    if (isBefore(end, start)) {
      setError("La fin ne peut pas précéder le début.");
      return;
    }

    // Use generic title if empty
    const eventTitle = title.trim() ? title : "(sans titre)";

    onSave({
      allDay,
      color,
      description,
      end,
      id: event?.id || "",
      location,
      start,
      title: eventTitle,
    });
  };

  const handleDelete = () => {
    if (event?.id) {
      onDelete(event.id);
    }
  };

  // Updated color options to match types.ts
  const colorOptions: Array<{
    value: EventColor;
    label: string;
    bgClass: string;
    borderClass: string;
  }> = [
    {
      bgClass: "bg-sky-400 data-checked:bg-sky-400",
      borderClass: "border-sky-400 data-checked:border-sky-400",
      label: EVENT_COLOR_LABELS.sky,
      value: "sky",
    },
    {
      bgClass: "bg-amber-400 data-checked:bg-amber-400",
      borderClass: "border-amber-400 data-checked:border-amber-400",
      label: EVENT_COLOR_LABELS.amber,
      value: "amber",
    },
    {
      bgClass: "bg-violet-400 data-checked:bg-violet-400",
      borderClass: "border-violet-400 data-checked:border-violet-400",
      label: EVENT_COLOR_LABELS.violet,
      value: "violet",
    },
    {
      bgClass: "bg-rose-400 data-checked:bg-rose-400",
      borderClass: "border-rose-400 data-checked:border-rose-400",
      label: EVENT_COLOR_LABELS.rose,
      value: "rose",
    },
    {
      bgClass: "bg-emerald-400 data-checked:bg-emerald-400",
      borderClass: "border-emerald-400 data-checked:border-emerald-400",
      label: EVENT_COLOR_LABELS.emerald,
      value: "emerald",
    },
    {
      bgClass: "bg-orange-400 data-checked:bg-orange-400",
      borderClass: "border-orange-400 data-checked:border-orange-400",
      label: EVENT_COLOR_LABELS.orange,
      value: "orange",
    },
  ];

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {event?.id ? "Modifier le rendez-vous" : CALENDAR_COPY.newEvent}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {event?.id
              ? "Modifier les informations de ce rendez-vous"
              : "Ajouter un rendez-vous à l’agenda"}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/15 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <div className="grid gap-4 py-4">
          <div className="*:not-first:mt-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </div>

          <div className="*:not-first:mt-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              value={description}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 *:not-first:mt-1.5">
              <Label htmlFor="start-date">Date de début</Label>
              <Popover onOpenChange={setStartDateOpen} open={startDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      className={cn(
                        "group border-input bg-background hover:bg-background w-full justify-between px-3 font-normal outline-offset-0 outline-none focus-visible:outline-[3px]",
                        !startDate && "text-muted-foreground",
                      )}
                      id="start-date"
                      variant={"outline"}
                    />
                  }
                >
                  <span
                    className={cn(
                      "truncate",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    {startDate
                      ? formatCalendarDate(startDate, "PPP")
                      : "Choisir une date"}
                  </span>
                  <CalendarIcon
                    aria-hidden="true"
                    className="text-muted-foreground/80 shrink-0"
                    size={16}
                  />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    defaultMonth={startDate}
                    locale={fr}
                    mode="single"
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        // If end date is before the new start date, update it to match the start date
                        if (isBefore(endDate, date)) {
                          setEndDate(date);
                        }
                        setError(null);
                        setStartDateOpen(false);
                      }
                    }}
                    selected={startDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!allDay && (
              <div className="min-w-28 *:not-first:mt-1.5">
                <Label htmlFor="start-time">Heure de début</Label>
                <Select
                  items={timeOptions}
                  onValueChange={(value) => value && setStartTime(value)}
                  value={startTime}
                >
                  <SelectTrigger id="start-time">
                    <SelectValue placeholder="Choisir une heure" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 *:not-first:mt-1.5">
              <Label htmlFor="end-date">Date de fin</Label>
              <Popover onOpenChange={setEndDateOpen} open={endDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      className={cn(
                        "group border-input bg-background hover:bg-background w-full justify-between px-3 font-normal outline-offset-0 outline-none focus-visible:outline-[3px]",
                        !endDate && "text-muted-foreground",
                      )}
                      id="end-date"
                      variant={"outline"}
                    />
                  }
                >
                  <span
                    className={cn(
                      "truncate",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    {endDate
                      ? formatCalendarDate(endDate, "PPP")
                      : "Choisir une date"}
                  </span>
                  <CalendarIcon
                    aria-hidden="true"
                    className="text-muted-foreground/80 shrink-0"
                    size={16}
                  />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    defaultMonth={endDate}
                    disabled={{ before: startDate }}
                    locale={fr}
                    mode="single"
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setError(null);
                        setEndDateOpen(false);
                      }
                    }}
                    selected={endDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!allDay && (
              <div className="min-w-28 *:not-first:mt-1.5">
                <Label htmlFor="end-time">Heure de fin</Label>
                <Select
                  items={timeOptions}
                  onValueChange={(value) => value && setEndTime(value)}
                  value={endTime}
                >
                  <SelectTrigger id="end-time">
                    <SelectValue placeholder="Choisir une heure" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={allDay}
              id="all-day"
              onCheckedChange={(checked) => setAllDay(checked === true)}
            />
            <Label htmlFor="all-day">{CALENDAR_COPY.allDay}</Label>
          </div>

          <div className="*:not-first:mt-1.5">
            <Label htmlFor="location">Lieu</Label>
            <Input
              id="location"
              onChange={(e) => setLocation(e.target.value)}
              value={location}
            />
          </div>
          <fieldset className="space-y-4">
            <legend className="text-foreground text-sm leading-none font-medium">
              Couleur
            </legend>
            <RadioGroup
              className="flex gap-1.5"
              defaultValue={colorOptions[0]?.value}
              onValueChange={(value: EventColor) => setColor(value)}
              value={color}
            >
              {colorOptions.map((colorOption) => (
                <RadioGroupItem
                  aria-label={colorOption.label}
                  className={cn(
                    "size-6 shadow-none",
                    colorOption.bgClass,
                    colorOption.borderClass,
                  )}
                  id={`color-${colorOption.value}`}
                  key={colorOption.value}
                  value={colorOption.value}
                />
              ))}
            </RadioGroup>
          </fieldset>
        </div>
        <DialogFooter className="flex-row sm:justify-between">
          {event?.id && (
            <Button
              aria-label="Supprimer le rendez-vous"
              onClick={handleDelete}
              size="icon"
              variant="outline"
            >
              <Trash2Icon aria-hidden="true" size={16} />
            </Button>
          )}
          <div className="flex flex-1 justify-end gap-2">
            <Button onClick={onClose} variant="outline">
              Annuler
            </Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
