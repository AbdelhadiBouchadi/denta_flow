"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { useTransition } from "react";

import EmptyState from "@/components/shared/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { WEEK_COPY } from "../constants";
import { useSchedulesFilters } from "../hooks/use-schedules-filters";
import { PractitionerSelect } from "./practitioner-select";
import { WeekEditor } from "./week-editor";
import { WeekSummary } from "./week-summary";

interface WeeklyHoursProps {
  isAdmin: boolean;
}

/**
 * «Heures d'ouverture». The practitioner is `?practitionerId=` (nuqs); empty,
 * `getWeek` resolves the signed-in practitioner or the first one, and the
 * selector shows whom it resolved. Both queries are prefetched by the page
 * with the same input.
 */
export const WeeklyHours = ({ isAdmin }: WeeklyHoursProps) => {
  const trpc = useTRPC();
  const [filters, setFilters] = useSchedulesFilters();
  const [isSwitching, startTransition] = useTransition();

  const { data: practitioners } = useSuspenseQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  const { data: week } = useSuspenseQuery(
    trpc.schedules.getWeek.queryOptions({
      practitionerId: filters.practitionerId || null,
    }),
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-foreground text-lg font-semibold">
          {WEEK_COPY.title}
        </h3>
        <p className="text-muted-foreground text-sm">{WEEK_COPY.description}</p>
      </div>

      {!week.practitionerId ? (
        <div className="py-6">
          <EmptyState
            title={WEEK_COPY.noPractitionerTitle}
            description={WEEK_COPY.noPractitionerDescription}
          />
        </div>
      ) : (
        <>
          <Field className="max-w-sm">
            <FieldLabel htmlFor="schedule-practitioner">
              {WEEK_COPY.practitioner}
            </FieldLabel>
            <PractitionerSelect
              id="schedule-practitioner"
              practitioners={practitioners.items}
              value={week.practitionerId}
              onChange={(practitionerId) =>
                // A transition keeps the current week on screen while the
                // next one loads, instead of the section's loading state.
                startTransition(() => {
                  void setFilters({ practitionerId });
                })
              }
            />
          </Field>

          {!week.isConfigured && (
            <p className="bg-info-subtle text-info-strong flex items-start gap-2 rounded-lg p-3 text-sm">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {WEEK_COPY.unconfigured}
            </p>
          )}

          <div
            className={cn(
              "transition-opacity",
              isSwitching && "pointer-events-none opacity-60",
            )}
          >
            {isAdmin ? (
              <WeekEditor
                // A fresh form per practitioner: no edit leaks across.
                key={week.practitionerId}
                practitionerId={week.practitionerId}
                days={week.days}
                otherPractitioners={practitioners.items.filter(
                  ({ id }) => id !== week.practitionerId,
                )}
              />
            ) : (
              <WeekSummary days={week.days} />
            )}
          </div>
        </>
      )}
    </section>
  );
};
