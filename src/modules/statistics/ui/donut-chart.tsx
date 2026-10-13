"use client";

import { Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { CHART_COPY as C } from "../constants";
import { formatPercent, shareOf } from "../rules";
import { StatTooltipContent } from "./chart-tooltip";
import { DONUT_HEIGHT, SectionEmpty } from "./section";

export interface DonutSlice {
  /** Stable React key — a method, a category, an insurer id. */
  id: string;
  /** French, from a label map or the database. */
  label: string;
  value: number;
  /** «Autres» is drawn muted, never with a series hue. */
  isOthers?: boolean;
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  /** The total, computed by the server — never summed here. */
  total: number;
  /** The centre's caption: «Encaissé», «Patients». */
  totalLabel: string;
  ariaLabel: string;
  /** Renders a value and the centre total (money masked, counts not). */
  formatValue: (value: number) => string;
}

/**
 * The page's donut (max 5 slices — the server folds the rest into
 * «Autres»): the total in the centre, and a legend that LISTS each slice's
 * label, value and share, so colour is never the only carrier of meaning.
 * A zero total shows the empty state, never an empty ring.
 *
 * Slices are keyed `s0` … `s4` in the chart config: the keys become CSS
 * variable names, and an insurer id is not one to trust there.
 */
export const DonutChart = ({
  slices,
  total,
  totalLabel,
  ariaLabel,
  formatValue,
}: DonutChartProps) => {
  if (total <= 0) return <SectionEmpty heightClass={DONUT_HEIGHT} />;

  let hue = 0;
  const data = slices.map((slice, index) => {
    const key = `s${index}`;
    const color = slice.isOthers
      ? "var(--subtle)"
      : `var(--chart-${(hue++ % 5) + 1})`;
    return { ...slice, key, color, fill: `var(--color-${key})` };
  });
  const config: ChartConfig = Object.fromEntries(
    data.map((slice) => [
      slice.key,
      { label: slice.label, color: slice.color },
    ]),
  );

  return (
    <div className={cn("flex flex-col gap-3", DONUT_HEIGHT)}>
      <ChartContainer
        config={config}
        role="img"
        aria-label={ariaLabel}
        className="mx-auto aspect-square h-[180px] w-[180px]"
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            cursor={false}
            content={
              <StatTooltipContent
                config={config}
                formatValue={formatValue}
                nameKey="key"
                hideLabel
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={56}
            outerRadius={86}
            strokeWidth={2}
          >
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null;
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 6}
                      className="fill-foreground text-sm font-semibold tabular-nums"
                    >
                      {formatValue(total)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 12}
                      className="fill-muted-foreground text-xs"
                    >
                      {totalLabel}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="flex min-w-0 flex-col gap-1.5 text-xs">
        {data.map((slice) => (
          <li key={slice.id} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: slice.color }}
            />
            <span className="text-foreground min-w-0 flex-1 truncate">
              {slice.label}
            </span>
            <span className="text-foreground font-medium tabular-nums">
              {formatValue(slice.value)}
            </span>
            <span
              className="text-muted-foreground w-12 text-right tabular-nums"
              aria-label={`${C.shareLabel} ${formatPercent(shareOf(slice.value, total))}`}
            >
              {formatPercent(shareOf(slice.value, total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
