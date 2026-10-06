import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  label: string;
  /** The tag row's own `color` — data configured per clinic, not a token. */
  color: string;
  /**
   * Already resolved by the caller from the tags slice's curated map. `null`
   * ⇒ no icon: an unknown stored name never breaks the pill.
   */
  icon?: LucideIcon | null;
  className?: string;
}

/**
 * The one tag pill: patient rows, the dossier header, the patient form, the
 * Paramètres tag list and its live preview all render this.
 *
 * The colour is handed to Tailwind as a custom property so the tint and the
 * text derive from the one value (AGENTS.md #32).
 */
const TagBadge = ({ label, color, icon: Icon, className }: TagBadgeProps) => (
  <Badge
    style={{ "--tag-color": color } as CSSProperties}
    className={cn(
      "text-label bg-[color-mix(in_oklab,var(--tag-color)_16%,transparent)] text-[var(--tag-color)]",
      className,
    )}
  >
    {Icon && <Icon aria-hidden="true" />}
    {label}
  </Badge>
);

export default TagBadge;
