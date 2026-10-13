"use client";

import { ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type TooltipContentProps = React.ComponentProps<typeof ChartTooltipContent>;

interface StatTooltipContentProps extends TooltipContentProps {
  config: ChartConfig;
  /** Renders one value — `formatDH`, the mask, or a count. Never inline. */
  formatValue: (value: number, key: string) => string;
  /** The datum field holding the header label (default `longLabel`). */
  labelField?: string;
}

/**
 * The tooltip every chart on `/statistiques` uses, on shadcn's
 * `ChartTooltipContent`. Its default row prints `value.toLocaleString()` —
 * the viewer's locale, and a server/client mismatch waiting to happen — so
 * each row is rendered here: the series colour, its French name from the
 * chart config (colour is never the only carrier of meaning), and the value
 * through the caller's formatter. The header is the bucket's long French
 * label from the server, never a date parsed in the browser.
 */
export const StatTooltipContent = ({
  config,
  formatValue,
  labelField = "longLabel",
  ...props
}: StatTooltipContentProps) => (
  <ChartTooltipContent
    {...props}
    labelFormatter={(_, payload) => {
      const datum = payload?.[0]?.payload as
        Record<string, unknown> | undefined;
      const label = datum?.[labelField];
      return typeof label === "string" ? label : null;
    }}
    formatter={(value, name, item) => {
      const key = String(name);
      return (
        <div className="flex w-full items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: item.color ?? item.payload?.fill }}
          />
          <span className="text-muted-foreground">
            {config[key]?.label ?? key}
          </span>
          <span className="text-foreground ml-auto pl-3 font-medium tabular-nums">
            {formatValue(Number(value), key)}
          </span>
        </div>
      );
    }}
  />
);
