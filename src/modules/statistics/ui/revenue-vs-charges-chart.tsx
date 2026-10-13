"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTRPC } from "@/trpc/client";
import { CHART_COPY as C, MONEY_SERIES_LABELS as M } from "../constants";
import type { PeriodInput } from "../period";
import { useAmountFormat } from "./amounts-visibility";
import { StatTooltipContent } from "./chart-tooltip";
import { CHART_HEIGHT, SectionCard } from "./section";

const CONFIG = {
  encaisseCents: { label: M.encaisse, color: "var(--chart-1)" },
  chargesCents: { label: M.charges, color: "var(--chart-3)" },
  resultatCents: { label: M.resultat, color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * «Encaissé et charges» — bars side by side (never stacked: charges are not
 * part of the encaissé), the résultat as a line. ABSENT, not empty, when
 * the period has no charge (`getRevenueVsCharges` returns null): a résultat
 * equal to the encaissé would claim «no costs».
 */
export const RevenueVsChargesChart = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getRevenueVsCharges.queryOptions(input),
  );
  const amount = useAmountFormat();

  if (data === null) return null;

  return (
    <SectionCard title={C.chargesTitle} description={C.chargesDescription}>
      <ChartContainer
        config={CONFIG}
        role="img"
        aria-label={C.chargesTitle}
        className={`${CHART_HEIGHT} aspect-auto w-full`}
      >
        <ComposedChart
          accessibilityLayer
          data={data.points}
          margin={{ left: 0, right: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            hide={!amount.isVisible}
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={amount.axis}
          />
          <ChartTooltip
            cursor={false}
            content={
              <StatTooltipContent config={CONFIG} formatValue={amount.full} />
            }
          />
          <Bar
            dataKey="encaisseCents"
            fill="var(--color-encaisseCents)"
            radius={3}
          />
          <Bar
            dataKey="chargesCents"
            fill="var(--color-chargesCents)"
            radius={3}
          />
          <Line
            dataKey="resultatCents"
            type="monotone"
            stroke="var(--color-resultatCents)"
            strokeWidth={2}
            dot={false}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        </ComposedChart>
      </ChartContainer>
    </SectionCard>
  );
};
