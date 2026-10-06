"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { env } from "@/lib/env";
import { ClinicLogo } from "@/modules/dashboard/ui/clinic-logo";
import { useTRPC } from "@/trpc/client";

interface BrandContentsProps {
  name: string;
  logoUrl: string | null;
}

/**
 * Logo, then the name, up to two lines and then an ellipsis: a «Cabinet
 * Dentaire Dr …» name is unreadable cut at one line. The sidebar button's
 * variant truncates its last span from a parent selector, hence the `!`.
 * `title` gives the full name back when even two lines are not enough.
 */
const BrandContents = ({ name, logoUrl }: BrandContentsProps) => (
  <>
    <ClinicLogo logoUrl={logoUrl} />
    <span
      title={name}
      className="font-heading text-foreground line-clamp-2 text-base leading-tight font-semibold wrap-break-word whitespace-normal!"
    >
      {name}
    </span>
  </>
);

const LoadedBrand = () => {
  const trpc = useTRPC();
  const { data: clinic } = useSuspenseQuery(trpc.clinic.get.queryOptions());

  return (
    <BrandContents
      name={clinic.name || env.NEXT_PUBLIC_CLINIC_NAME}
      logoUrl={clinic.logoUrl}
    />
  );
};

/**
 * The sidebar brand, from the `clinic.get` row the dashboard layout prefetches.
 *
 * `useSuspenseQuery` inside its own boundary, never plain `useQuery`. The
 * prefetch is not awaited, so it reaches the browser still pending. With
 * `useQuery`, the server rendered the fallback name while the browser, whose
 * cache already held the streamed row by hydration time, rendered the real
 * one: a hydration mismatch that made React re-render the whole page on the
 * client. Suspending makes the server wait for the row and stream it, so both
 * sides render the same name (04-hydration.md §4).
 *
 * The deployment name and the fallback mark stand in while the row is on its
 * way, and if it fails, so the brand never breaks the shell.
 */
export const ClinicBrand = () => {
  const fallback = (
    <BrandContents name={env.NEXT_PUBLIC_CLINIC_NAME} logoUrl={null} />
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedBrand />
      </Suspense>
    </ErrorBoundary>
  );
};
