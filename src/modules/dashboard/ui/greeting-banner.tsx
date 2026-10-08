import { formatLongDate } from "@/lib/format";
import { greetingLine, todaySummary } from "../constants";
import type { DashboardStats } from "../types";

interface GreetingBannerProps {
  stats: Pick<
    DashboardStats,
    | "asOf"
    | "greeting"
    | "viewerName"
    | "todayTotal"
    | "todayRemaining"
    | "completedCount"
  >;
}

/**
 * «Bonjour, …», the clinic date and one sentence about the day. The greeting
 * and the date come from the server's `asOf` — the same instant the counts
 * were taken at — so the banner never says «Bonjour» over yesterday's date,
 * and the server and the browser render the same text.
 */
export const GreetingBanner = ({ stats }: GreetingBannerProps) => (
  <section className="bg-primary text-primary-foreground flex flex-col gap-1 rounded-xl p-5 md:p-6">
    <h1 className="font-heading text-h2 wrap-break-word">
      {greetingLine(stats.greeting, stats.viewerName)}
    </h1>
    {/* A browser's tz database can lag Node's around an offset change. */}
    <p
      suppressHydrationWarning
      className="text-body opacity-90 first-letter:uppercase"
    >
      {formatLongDate(stats.asOf)}
    </p>
    <p className="text-body-lg mt-2 font-medium">
      {todaySummary({
        total: stats.todayTotal,
        remaining: stats.todayRemaining,
        completed: stats.completedCount,
      })}
    </p>
  </section>
);
