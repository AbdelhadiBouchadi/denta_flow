"use client";

import { CircleHelpIcon } from "lucide-react";
import { useId, type TransitionStartFunction } from "react";

import DayFilter from "@/components/shared/day-filter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isCalendarDate, toClinicDate } from "@/lib/time";
import {
  STATISTICS_COPY as COPY,
  STATISTICS_PERIOD_OPTIONS,
  STATISTICS_PERIOD_VALUES,
} from "../constants";
import { useStatisticsFilters } from "../hooks/use-statistics-filters";
import { firstDayOfMonth } from "../period";
import { StatisticsPeriod } from "../types";
import { useAmountsVisibility } from "./amounts-visibility";

interface StatisticsHeaderProps {
  /** The view's transition: the figures on screen stay while the next load. */
  startTransition: TransitionStartFunction;
  /** The schema's French message for an invalid custom range, or null. */
  error: string | null;
}

/**
 * No reference screen exists in `prompt_material/` for `/statistiques`: the
 * header follows `/paiements` and the dashboard («Encaissements» period
 * `Select`) — title, then the period, the custom range through the shared
 * `DayFilter`, the «Encaissé ou produit ?» help, and the amounts switch.
 *
 * The period is URL state (nuqs, mirrored by `params.ts`); every change runs
 * inside the view's transition, so the cards keep the previous period's
 * figures while the next period loads — no full-page flash. React Query keys
 * each period apart, so a late answer for an old period can only fill that
 * period's cache entry, never the one on screen.
 */
export const StatisticsHeader = ({
  startTransition,
  error,
}: StatisticsHeaderProps) => {
  const [filters, setFilters] = useStatisticsFilters();
  const { isVisible, setIsVisible } = useAmountsVisibility();
  const switchId = useId();

  const update = (next: Partial<typeof filters>) =>
    startTransition(() => {
      void setFilters(next);
    });

  const changePeriod = (value: string | null) => {
    const period = STATISTICS_PERIOD_VALUES.find((option) => option === value);
    if (!period) return;
    if (period !== StatisticsPeriod.Custom) {
      update({ period, from: "", to: "" });
      return;
    }
    // A custom range opens on a valid one: this month up to today.
    const today = toClinicDate(new Date());
    update({
      period,
      from: isCalendarDate(filters.from)
        ? filters.from
        : firstDayOfMonth(today),
      to: isCalendarDate(filters.to) ? filters.to : today,
    });
  };

  const isCustom = filters.period === StatisticsPeriod.Custom;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-h2 md:text-h1 text-foreground">
            {COPY.pageTitle}
          </h1>
          <p className="text-muted-foreground text-sm">
            {COPY.pageDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={isVisible}
            onCheckedChange={(checked) => setIsVisible(checked)}
          />
          <Label htmlFor={switchId} className="text-sm">
            {COPY.showAmounts}
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.period}
          onValueChange={changePeriod}
          items={STATISTICS_PERIOD_OPTIONS}
        >
          <SelectTrigger aria-label={COPY.periodLabel} className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {STATISTICS_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isCustom && (
          <>
            <DayFilter
              label={COPY.from}
              value={filters.from}
              onChange={(from) => update({ from })}
            />
            <DayFilter
              label={COPY.to}
              value={filters.to}
              onChange={(to) => update({ to })}
            />
          </>
        )}

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              />
            }
          >
            <CircleHelpIcon />
            {COPY.helpLabel}
          </PopoverTrigger>
          <PopoverContent align="start" className="max-w-80 text-sm">
            {COPY.helpText}
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <p
          role="alert"
          className="text-danger-strong bg-danger-subtle rounded-lg px-3 py-2 text-sm"
        >
          <span className="font-medium">{COPY.invalidPeriodTitle}</span> {error}
        </p>
      )}
    </div>
  );
};
