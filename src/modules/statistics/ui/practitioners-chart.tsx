"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTRPC } from "@/trpc/client";
import { CHART_COPY as C } from "../constants";
import type { PeriodInput } from "../period";
import { useAmountFormat } from "./amounts-visibility";
import { StatTooltipContent } from "./chart-tooltip";
import { CHART_HEIGHT, SectionCard, SectionEmpty } from "./section";

const CONFIG = {
  completed: { label: C.practitionersAppointments, color: "var(--chart-1)" },
  productionCents: {
    label: C.practitionersProduction,
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type Metric = keyof typeof CONFIG;

const METRICS = Object.keys(CONFIG) as Metric[];

/**
 * «Par praticien» — honoured appointments OR production, one at a time: a
 * count and an amount on one axis would be two units on one scale. No
 * revenue per practitioner: payments land on the patient account.
 */
export const PractitionersChart = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getByPractitioner.queryOptions(input),
  );
  const amount = useAmountFormat();
  const [metric, setMetric] = useState<Metric>("completed");

  const rows = data.practitioners.map((practitioner) => ({
    ...practitioner,
    label: practitioner.name ?? C.noPractitioner,
  }));
  const isCount = metric === "completed";

  return (
    <SectionCard
      title={C.practitionersTitle}
      description={C.practitionersDescription}
      action={
        <ToggleGroup
          aria-label={C.practitionersTitle}
          variant="outline"
          size="sm"
          spacing={0}
          value={[metric]}
          onValueChange={(values) => {
            const next = METRICS.find((key) => key === values[0]);
            if (next) setMetric(next);
          }}
        >
          {METRICS.map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {CONFIG[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {rows.length === 0 ? (
        <SectionEmpty heightClass={CHART_HEIGHT} />
      ) : (
        <ChartContainer
          config={CONFIG}
          role="img"
          aria-label={C.practitionersTitle}
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
              width={isCount ? 32 : 64}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              hide={!isCount && !amount.isVisible}
              tickFormatter={isCount ? undefined : amount.axis}
            />
            <ChartTooltip
              cursor={false}
              content={
                <StatTooltipContent
                  config={CONFIG}
                  labelField="label"
                  formatValue={(value, key) =>
                    key === "completed" ? String(value) : amount.full(value)
                  }
                />
              }
            />
            <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </SectionCard>
  );
};
