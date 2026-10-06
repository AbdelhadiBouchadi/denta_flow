import TagBadge from "@/components/shared/tag-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTagIcon } from "@/modules/tags/constants";
import { EMPTY_FIELD, MAX_VISIBLE_TAGS } from "../constants";
import type { PatientTagSummary } from "../types";

/**
 * A patient's tags as small colour pills — the shared TagBadge, the same one
 * Paramètres renders. The icon comes from the tags slice's curated static map,
 * so it costs no lazy chunk; an unknown stored name renders no icon.
 */

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
        <TagBadge
          key={tag.id}
          label={tag.label}
          color={tag.color}
          icon={getTagIcon(tag.icon)}
        />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-label">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
};
