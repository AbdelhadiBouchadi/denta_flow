"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc/client";
import {
  CHART_COPY as C,
  METHOD_LABELS,
  MONEY_SERIES_LABELS,
  PAYMENT_METHOD_SERIES,
  REVENUE_VIEW_OPTIONS,
} from "../constants";
import type { PeriodInput } from "../period";
import { RevenueView } from "../types";
import { useAmountFormat } from "./amounts-visibility";
import { StatTooltipContent } from "./chart-tooltip";
import { CHART_HEIGHT, SectionCard, SectionEmpty } from "./section";

/** One hue per method (globals.css tokens) — five methods, five series. */
const BY_METHOD_CONFIG: ChartConfig = Object.fromEntries(
  PAYMENT_METHOD_SERIES.map((method, index) => [
    method,
    { label: METHOD_LABELS[method], color: `var(--chart-${index + 1})` },
  ]),
);

const COLLECTED_VS_PRODUCED_CONFIG = {
  encaisse: { label: MONEY_SERIES_LABELS.encaisse, color: "var(--chart-1)" },
  production: {
    label: MONEY_SERIES_LABELS.production,
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/**
 * «Encaissements» — the shadcn «Area Chart – Interactive» layout (title,
 * description, a small view `Select`, ~250 px, gradient fills, legend), with
 * our data handling: the server returns exactly the period's buckets with
 * their French labels; nothing is filtered or date-parsed here.
 *
 * Two views, local state:
 * - «Par mode de paiement»: STACKED areas — the methods are parts of one
 *   total, the encaissé;
 * - «Encaissé et produit»: two NON-stacked areas — two different
 *   quantities, never added up (decision 2).
 */
export const RevenueChart = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getRevenueSeries.queryOptions(input),
  );
  const amount = useAmountFormat();
  const [view, setView] = useState(RevenueView.ByMethod);
  const gradientId = useId().replace(/:/g, "");

  // recharts reads flat keys; the config keys double as CSS variable names.
  const points = useMemo(
    () =>
      data.points.map((point) => ({
        label: point.label,
        longLabel: point.longLabel,
        encaisse: point.encaisseCents,
        production: point.productionCents,
        ...point.encaisseParMode,
      })),
    [data],
  );

  const isByMethod = view === RevenueView.ByMethod;
  const config: ChartConfig = isByMethod
    ? BY_METHOD_CONFIG
    : COLLECTED_VS_PRODUCED_CONFIG;
  const keys = Object.keys(config);
  const isEmpty = data.points.every(
    (point) => point.encaisseCents === 0 && point.productionCents === 0,
  );

  return (
    <SectionCard
      title={C.revenueTitle}
      description={isByMethod ? C.revenueByMethod : C.revenueVsProduction}
      action={
        <Select
          value={view}
          onValueChange={(next) => {
            if (next) setView(next);
          }}
          items={REVENUE_VIEW_OPTIONS}
        >
          <SelectTrigger size="sm" aria-label={C.revenueViewLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {REVENUE_VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {isEmpty ? (
        <SectionEmpty heightClass={CHART_HEIGHT} />
      ) : (
        <ChartContainer
          config={config}
          role="img"
          aria-label={C.revenueTitle}
          className={`${CHART_HEIGHT} aspect-auto w-full`}
        >
          <AreaChart
            accessibilityLayer
            data={points}
            margin={{ left: 0, right: 8 }}
          >
            <defs>
              {keys.map((key) => (
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
            {/* Masked: no amounts on the axis — the shapes stay. */}
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
                <StatTooltipContent
                  config={config}
                  formatValue={amount.full}
                  indicator="dot"
                />
              }
            />
            {keys.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                // Parts of one total stack; two quantities never do.
                stackId={isByMethod ? "methods" : undefined}
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
