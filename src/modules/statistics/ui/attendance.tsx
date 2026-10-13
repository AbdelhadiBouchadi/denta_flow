"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  CHART_COPY as C,
  WEEKDAY_LONG_LABELS,
  WEEKDAY_SHORT_LABELS,
} from "../constants";
import type { PeriodInput } from "../period";
import { StatTooltipContent } from "./chart-tooltip";
import { CHART_HEIGHT, SectionCard, SectionEmpty } from "./section";

/**
 * «Fréquentation» — two cards on ONE query (`getAppointmentsDistribution`,
 * one cache entry): honoured appointments by weekday, and by weekday × hour.
 * The weekday and hour were read on the clinic's clock in TypeScript; this
 * file only draws them.
 */

const useDistribution = (input: PeriodInput) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.statistics.getAppointmentsDistribution.queryOptions(input),
  ).data;
};

const WEEKDAY_CONFIG = {
  count: { label: C.honoredSeries, color: "var(--chart-1)" },
} satisfies ChartConfig;

export const WeekdayChart = ({ input }: { input: PeriodInput }) => {
  const data = useDistribution(input);
  const rows = data.weekdays.map((day) => ({
    count: day.count,
    label: WEEKDAY_SHORT_LABELS[day.weekdayIndex],
    longLabel: WEEKDAY_LONG_LABELS[day.weekdayIndex],
  }));
  const isEmpty = rows.every((row) => row.count === 0);

  return (
    <SectionCard title={C.weekdayTitle} description={C.weekdayDescription}>
      {isEmpty ? (
        <SectionEmpty heightClass={CHART_HEIGHT} />
      ) : (
        <ChartContainer
          config={WEEKDAY_CONFIG}
          role="img"
          aria-label={C.weekdayTitle}
          className={`${CHART_HEIGHT} aspect-auto w-full`}
        >
          <BarChart
            accessibilityLayer
            data={rows}
            margin={{ left: 0, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={
                <StatTooltipContent
                  config={WEEKDAY_CONFIG}
                  formatValue={(value) => String(value)}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </SectionCard>
  );
};

// ── Heatmap ─────────────────────────────────────────────────────────────────

/**
 * Five steps of the primary token, by share of the busiest cell. A zero
 * cell is the muted surface, so «none» never reads as «a few».
 */
const LEVEL_CLASSES = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/65",
  "bg-primary/90",
] as const;

const levelOf = (count: number, max: number) =>
  count === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4));

/** The opening hours always shown, widened to any hour with activity. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 19;

/**
 * Weekday × hour — a plain CSS grid, not a recharts chart. Each cell names
 * its weekday, hour and count (tooltip and `aria-label`): the shade is never
 * the only carrier of meaning. The grid scrolls inside its own container on
 * a phone; the page never scrolls sideways.
 */
export const AttendanceHeatmap = ({ input }: { input: PeriodInput }) => {
  const data = useDistribution(input);
  const active = data.cells.filter((cell) => cell.count > 0);

  if (active.length === 0) {
    return (
      <SectionCard title={C.heatmapTitle} description={C.heatmapDescription}>
        <SectionEmpty heightClass={CHART_HEIGHT} />
      </SectionCard>
    );
  }

  const max = Math.max(...active.map((cell) => cell.count));
  const firstHour = Math.min(
    DEFAULT_FIRST_HOUR,
    ...active.map((cell) => cell.hour),
  );
  const lastHour = Math.max(
    DEFAULT_LAST_HOUR,
    ...active.map((cell) => cell.hour),
  );
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, index) => firstHour + index,
  );
  const countAt = (weekdayIndex: number, hour: number) =>
    data.cells[weekdayIndex * 24 + hour].count;

  return (
    <SectionCard title={C.heatmapTitle} description={C.heatmapDescription}>
      <div className={cn("flex flex-col justify-center gap-3", CHART_HEIGHT)}>
        <div className="overflow-x-auto pb-1">
          <div
            role="grid"
            aria-label={C.heatmapTitle}
            className="grid min-w-max gap-1 text-[10px]"
            style={{
              gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(1.5rem, 1fr))`,
            }}
          >
            <span aria-hidden="true" />
            {hours.map((hour) => (
              <span
                key={hour}
                aria-hidden="true"
                className="text-muted-foreground text-center tabular-nums"
              >
                {hour}
              </span>
            ))}
            {WEEKDAY_SHORT_LABELS.map((weekday, weekdayIndex) => (
              <div key={weekday} role="row" className="contents">
                <span
                  role="rowheader"
                  className="text-muted-foreground self-center"
                >
                  {weekday}
                </span>
                {hours.map((hour) => {
                  const count = countAt(weekdayIndex, hour);
                  const description = C.heatmapCell(
                    WEEKDAY_LONG_LABELS[weekdayIndex],
                    hour,
                    count,
                  );
                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger
                        render={
                          <div
                            role="gridcell"
                            aria-label={description}
                            tabIndex={-1}
                            className={cn(
                              "h-5 rounded-[3px]",
                              LEVEL_CLASSES[levelOf(count, max)],
                            )}
                          />
                        }
                      />
                      <TooltipContent>{description}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="text-muted-foreground flex items-center justify-end gap-1 text-[10px]"
        >
          <span className="mr-1">{C.heatmapLegendLess}</span>
          {LEVEL_CLASSES.map((level) => (
            <span key={level} className={cn("size-3 rounded-[3px]", level)} />
          ))}
          <span className="ml-1">{C.heatmapLegendMore}</span>
        </div>
      </div>
    </SectionCard>
  );
};
