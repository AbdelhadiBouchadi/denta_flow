"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTRPC } from "@/trpc/client";
import { APPOINTMENT_OUTCOME_LABELS as O, CHART_COPY as C } from "../constants";
import type { PeriodInput } from "../period";
import { StatTooltipContent } from "./chart-tooltip";
import { CHART_HEIGHT, SectionCard, SectionEmpty } from "./section";

/**
 * Outcomes stack: together they ARE the period's appointments. Colours are
 * the status tokens the appointment badges use — honorés success, absents
 * warning, annulés danger, à venir muted.
 */
const CONFIG = {
  completed: { label: O.completed, color: "var(--success)" },
  noShow: { label: O.noShow, color: "var(--warning)" },
  canceled: { label: O.canceled, color: "var(--danger)" },
  upcoming: { label: O.upcoming, color: "var(--subtle)" },
} satisfies ChartConfig;

const KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];

/** Counts are never masked. */
const formatCount = (value: number) => String(value);

/** «Rendez-vous» — the period's appointments by outcome, stacked. */
export const AppointmentsChart = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getAppointmentsSeries.queryOptions(input),
  );
  const gradientId = useId().replace(/:/g, "");
  const isEmpty = data.points.every((point) =>
    KEYS.every((key) => point[key] === 0),
  );

  return (
    <SectionCard
      title={C.appointmentsTitle}
      description={C.appointmentsDescription}
    >
      {isEmpty ? (
        <SectionEmpty heightClass={CHART_HEIGHT} />
      ) : (
        <ChartContainer
          config={CONFIG}
          role="img"
          aria-label={C.appointmentsTitle}
          className={`${CHART_HEIGHT} aspect-auto w-full`}
        >
          <AreaChart
            accessibilityLayer
            data={data.points}
            margin={{ left: 0, right: 8 }}
          >
            <defs>
              {KEYS.map((key) => (
                <linearGradient
                  key={key}
                  id={`${gradientId}-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
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
                  config={CONFIG}
                  formatValue={formatCount}
                  indicator="dot"
                />
              }
            />
            {KEYS.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stackId="outcomes"
                stroke={`var(--color-${key})`}
                fill={`url(#${gradientId}-${key})`}
                strokeWidth={2}
              />
            ))}
            <ChartLegend
              content={<ChartLegendContent className="flex-wrap" />}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </SectionCard>
  );
};
