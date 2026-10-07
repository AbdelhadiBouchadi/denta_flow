"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_COPY } from "../constants";
import { legendDotClass } from "./calendar-adapter";

const SHOW_CANCELED_LABEL = "Afficher les annulés";
const LEGEND_LABEL = "Types de rendez-vous";

interface CalendarToolbarProps {
  /** The practitioner shown: an id, or "" for everybody. */
  practitionerId: string;
  onPractitionerChange: (practitionerId: string) => void;
  showCanceled: boolean;
  onShowCanceledChange: (showCanceled: boolean) => void;
  isPending?: boolean;
}

/**
 * Above the agenda: who is shown, what the colours mean, and whether
 * cancelled appointments are drawn. Both option lists are prefetched by the
 * route, so they resolve from the dehydrated cache.
 */
export const CalendarToolbar = ({
  practitionerId,
  onPractitionerChange,
  showCanceled,
  onShowCanceledChange,
  isPending,
}: CalendarToolbarProps) => {
  const trpc = useTRPC();
  const { data: practitioners } = useSuspenseQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  const { data: types } = useSuspenseQuery(
    trpc.appointmentTypes.getMany.queryOptions(),
  );
  const activeTypes = types.items.filter((type) => type.isActive);

  return (
    <div
      data-pending={isPending ? "" : undefined}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 data-pending:opacity-70"
    >
      <Select
        value={practitionerId || null}
        onValueChange={(value) => onPractitionerChange(value ?? "")}
        items={[
          { label: APPOINTMENT_COPY.allPractitioners, value: null },
          ...practitioners.items.map((p) => ({ label: p.name, value: p.id })),
        ]}
      >
        <SelectTrigger
          size="default"
          className="h-9 min-w-48"
          aria-label={APPOINTMENT_COPY.allPractitioners}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>
            {APPOINTMENT_COPY.allPractitioners}
          </SelectItem>
          {practitioners.items.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="show-canceled"
          checked={showCanceled}
          onCheckedChange={(checked) => onShowCanceledChange(checked)}
        />
        <Label htmlFor="show-canceled">{SHOW_CANCELED_LABEL}</Label>
      </div>

      <ul
        aria-label={LEGEND_LABEL}
        className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
      >
        {activeTypes.map((type) => (
          <li key={type.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 rounded-full",
                legendDotClass(type.color),
              )}
            />
            {type.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-full", legendDotClass(null))}
          />
          {APPOINTMENT_COPY.noType}
        </li>
      </ul>
    </div>
  );
};
