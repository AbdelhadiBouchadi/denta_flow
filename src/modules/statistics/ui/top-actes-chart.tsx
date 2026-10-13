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
import { useIsMobile } from "@/hooks/use-mobile";
import { useTRPC } from "@/trpc/client";
import { CHART_COPY as C, TOP_ACTES_ORDER_LABELS } from "../constants";
import type { PeriodInput } from "../period";
import { TopActesOrder } from "../types";
import { useAmountFormat } from "./amounts-visibility";
import { StatTooltipContent } from "./chart-tooltip";
import { BARS_HEIGHT, SectionCard, SectionEmpty } from "./section";

const CONFIG = {
  count: { label: C.topActesCount, color: "var(--chart-1)" },
  productionCents: { label: C.topActesValue, color: "var(--chart-2)" },
} satisfies ChartConfig;

/** An acte label is long («Curetage et obturation coronaire de…»). */
const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * «Actes les plus réalisés» — horizontal bars, the 10 billable actes by
 * count, or by production value (the toggle, local state). The full label
 * is in the tooltip; the axis shortens it, more on a phone.
 */
export const TopActesChart = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getTopActes.queryOptions(input),
  );
  const amount = useAmountFormat();
  const isMobile = useIsMobile();
  const [order, setOrder] = useState(TopActesOrder.ByCount);

  const isByCount = order === TopActesOrder.ByCount;
  const rows = isByCount ? data.byCount : data.byValue;
  const metric = isByCount ? "count" : "productionCents";
  const labelMax = isMobile ? 14 : 24;

  return (
    <SectionCard
      title={C.topActesTitle}
      description={C.topActesDescription(TOP_ACTES_ORDER_LABELS[order])}
      action={
        <ToggleGroup
          aria-label={C.topActesOrderLabel}
          variant="outline"
          size="sm"
          spacing={0}
          value={[order]}
          onValueChange={(values) => {
            // Narrowed by lookup: a pressed item is one of ours, or nothing.
            const next = Object.values(TopActesOrder).find(
              (value) => value === values[0],
            );
            if (next) setOrder(next);
          }}
        >
          {Object.values(TopActesOrder).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {TOP_ACTES_ORDER_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {rows.length === 0 ? (
        <SectionEmpty heightClass={BARS_HEIGHT} />
      ) : (
        <ChartContainer
          config={CONFIG}
          role="img"
          aria-label={C.topActesTitle}
          className={`${BARS_HEIGHT} aspect-auto w-full`}
        >
          <BarChart
            accessibilityLayer
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 12 }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={isMobile ? 96 : 160}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(label: string) => truncate(label, labelMax)}
            />
            <XAxis
              type="number"
              dataKey={metric}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              // A value axis carries amounts: hidden while they are masked.
              hide={!isByCount && !amount.isVisible}
              tickFormatter={isByCount ? undefined : amount.axis}
            />
            <ChartTooltip
              cursor={false}
              content={
                <StatTooltipContent
                  config={CONFIG}
                  labelField="label"
                  formatValue={(value, key) =>
                    key === "count" ? String(value) : amount.full(value)
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
