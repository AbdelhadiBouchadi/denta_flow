import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { ACTIVITY_COPY as COPY } from "../constants";
import type { ActivityItem } from "../types";
import ActivityEntityIcon from "./activity-entity-icon";

interface Props {
  items: ActivityItem[];
}

/**
 * One column — time, marker, sentence — not the reference's alternating
 * sides, which halve the width a sentence gets on a phone. The rail is a
 * border on the list, the markers sit on it. A long sentence wraps
 * (`break-words`, `min-w-0`) and never widens the page.
 */
const ActivityTimeline = ({ items }: Props) => (
  <ol className="relative flex flex-col">
    {items.map((item, index) => (
      <li
        key={item.id}
        className="grid grid-cols-[2.75rem_2rem_minmax(0,1fr)] gap-x-3"
      >
        <time className="text-muted-foreground pt-1.5 text-right text-xs font-medium tabular-nums">
          {item.time}
        </time>

        <div className="relative flex justify-center">
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              className="bg-border absolute top-8 bottom-0 w-px"
            />
          )}
          <ActivityEntityIcon entityType={item.entityType} />
        </div>

        <div className="flex min-w-0 flex-col gap-1 pb-5">
          <p className="text-body text-foreground pt-1 break-words">
            {item.summary}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">
              {COPY.by} {item.staffName ?? COPY.unknownStaff}
            </span>
            {item.patientId && (
              <Link
                href={`/patients/${item.patientId}`}
                className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
              >
                {COPY.openDossier}
                <ArrowRightIcon className="size-3" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </li>
    ))}
  </ol>
);

export default ActivityTimeline;
