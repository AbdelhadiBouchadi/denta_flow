"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { ODONTOGRAM_COPY as COPY } from "../constants";

/**
 * The tooth grid's footprint while the engine downloads: 16 columns, two
 * arches of side and occlusal tiles (prompts/28: no layout jump). On a phone
 * the real grid is wider than the screen and scrolls in its box; so does
 * this one.
 */
export const OdontogramSkeleton = ({ withPanel }: { withPanel: boolean }) => (
  <div
    role="status"
    aria-label={COPY.loading}
    className="grid gap-3.5 p-3.5 2xl:grid-cols-[minmax(0,1fr)_360px]"
  >
    <div className="min-w-0 overflow-hidden rounded-2xl border">
      <div className="flex h-[4.5rem] items-center justify-between gap-3 border-b px-3.5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="hidden h-11 w-48 sm:block" />
      </div>
      <div className="grid w-full min-w-[41rem] grid-cols-16 gap-1 p-2.5">
        {Array.from({ length: 16 * 4 }, (_, i) => (
          <Skeleton
            key={i}
            className={
              i < 16 || i >= 48
                ? "h-[7.75rem] rounded-xl"
                : "h-[5.25rem] rounded-xl"
            }
          />
        ))}
      </div>
    </div>
    {withPanel && <Skeleton className="h-[30rem] rounded-2xl" />}
  </div>
);

/**
 * The only way into the engine: client-only (it reads the DOM on mount) and
 * code-split, so the library's 3 MB load when the «Odontogramme» tab opens,
 * never on the dossier's first paint (docs/spikes/odontogram.md, gate 7).
 */
const OdontogramChart = dynamic(() => import("./odontogram-engine"), {
  ssr: false,
  loading: () => <OdontogramSkeleton withPanel />,
});

export default OdontogramChart;
