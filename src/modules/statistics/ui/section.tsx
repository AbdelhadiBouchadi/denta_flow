"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { STATISTICS_COPY as COPY } from "../constants";

/** Body heights — shared by each chart, its skeleton, empty and error states. */
export const CHART_HEIGHT = "h-[250px]";
export const DONUT_HEIGHT = "h-[316px]";
export const BARS_HEIGHT = "h-[320px]";

/**
 * One card of `/statistiques`: a title, a one-line description of exactly
 * what it counts, an optional action (a view `Select`, a toggle), the body.
 * `region` + `aria-label` so a screen reader can jump between sections.
 */
export const SectionCard = ({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <Card role="region" aria-label={title} className={cn("min-w-0", className)}>
    <CardHeader>
      <CardTitle className="text-h4">{title}</CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
      {action && <CardAction>{action}</CardAction>}
    </CardHeader>
    <CardContent className="min-w-0">{children}</CardContent>
  </Card>
);

/** «Aucune donnée sur cette période.» at the chart's own height. */
export const SectionEmpty = ({ heightClass }: { heightClass: string }) => (
  <div
    className={cn(
      "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed text-sm",
      heightClass,
    )}
  >
    {COPY.empty}
  </div>
);

/** The failure body: what went wrong (French) and «Réessayer». */
const SectionError = ({
  error,
  onRetry,
  heightClass,
}: {
  error: unknown;
  onRetry: () => void;
  heightClass: string;
}) => (
  <div
    role="alert"
    className={cn(
      "flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-4 text-center",
      heightClass,
    )}
  >
    <AlertCircleIcon className="text-destructive size-5" />
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{COPY.errorTitle}</span>
      <span className="text-muted-foreground text-xs">
        {getErrorMessage(error)}
      </span>
    </div>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RotateCcwIcon />
      {COPY.retry}
    </Button>
  </div>
);

/**
 * A section's own boundaries (04-hydration.md §4 rule 4: Suspense outside,
 * ErrorBoundary inside), so a slow section never holds the page and a
 * failing one never blanks it.
 *
 * «Réessayer» resets this section's failed queries (QueryErrorResetBoundary)
 * before the boundary, or `useSuspenseQuery` would rethrow the cached error.
 * A period change happens inside a transition: an already revealed section
 * keeps its figures until the next period's arrive, instead of flashing
 * back to its skeleton.
 */
export const SectionBoundary = ({
  loading,
  renderError,
  children,
}: {
  loading: React.ReactNode;
  renderError: (body: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <Suspense fallback={loading}>
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) =>
            renderError(
              <SectionError
                error={error}
                onRetry={() => resetErrorBoundary()}
                heightClass="min-h-40"
              />,
            )
          }
        >
          {children}
        </ErrorBoundary>
      </Suspense>
    )}
  </QueryErrorResetBoundary>
);

interface SectionProps {
  title: string;
  description: string;
  /** The body's height, shared by the chart, its skeleton and its states. */
  heightClass: string;
  /** Grid placement (`xl:col-span-2`…), held by a wrapper every state shares. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A chart card inside its boundaries. The skeleton and the error keep the
 * card's title and the body's height: no layout jump when the data lands
 * or fails. The loaded chart renders its own `SectionCard`, so the grid
 * placement lives on a wrapper, not on the card — or it would vanish once
 * the data lands.
 */
export const Section = ({
  title,
  description,
  heightClass,
  className,
  children,
}: SectionProps) => {
  const shell = (body: React.ReactNode) => (
    <SectionCard title={title} description={description}>
      {body}
    </SectionCard>
  );

  return (
    <div className={cn("flex min-w-0 flex-col *:flex-1", className)}>
      <SectionBoundary
        loading={shell(
          <Skeleton
            role="status"
            aria-label={COPY.loading}
            className={cn("w-full rounded-lg", heightClass)}
          />,
        )}
        renderError={(body) =>
          shell(<div className={cn("flex flex-col", heightClass)}>{body}</div>)
        }
      >
        {children}
      </SectionBoundary>
    </div>
  );
};
