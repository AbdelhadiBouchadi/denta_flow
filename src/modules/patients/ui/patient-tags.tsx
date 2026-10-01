import type { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EMPTY_FIELD, MAX_VISIBLE_TAGS } from "../constants";
import type { PatientTagSummary } from "../types";

/**
 * A patient's tags as small colour pills.
 *
 * The colour is the tag row's own `color`, configured per clinic — data, not a
 * hardcoded hex (AGENTS.md #32). It is handed to Tailwind as a custom property
 * so the tint and the text derive from the one value.
 *
 * The tag's `icon` column is carried by the procedure but not rendered yet:
 * resolving a lucide name at runtime costs a lazy chunk per distinct icon, and
 * the label already carries the meaning.
 */

const PatientTagPill = ({ tag }: { tag: PatientTagSummary }) => (
  <Badge
    style={{ "--tag-color": tag.color } as CSSProperties}
    className="text-label bg-[color-mix(in_oklab,var(--tag-color)_16%,transparent)] text-[var(--tag-color)]"
  >
    {tag.label}
  </Badge>
);

interface PatientTagsProps {
  tags: PatientTagSummary[];
  /** Pills shown before the rest collapse into «+N». */
  max?: number;
  className?: string;
}

export const PatientTags = ({
  tags,
  max = MAX_VISIBLE_TAGS,
  className,
}: PatientTagsProps) => {
  if (tags.length === 0) {
    return <span className="text-muted-foreground">{EMPTY_FIELD}</span>;
  }

  const visible = tags.slice(0, max);
  const hiddenCount = tags.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <PatientTagPill key={tag.id} tag={tag} />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-label">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
};
