import { ArmchairIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * The «Salle d’attente» slot in the navbar.
 *
 * The count is an em dash, not a zero: the waiting room is a V1.1 feature and
 * showing «0» would be a fabricated number on a screen full of real ones
 * (AGENTS.md §0.5). Server Component — nothing here is interactive.
 */
export const WaitingRoomBadge = () => {
  return (
    <Badge
      variant="secondary"
      className="hidden h-7 gap-1.5 px-2.5 text-xs sm:inline-flex"
    >
      <ArmchairIcon />
      Salle d’attente
      <span className="text-muted-foreground tabular-nums">—</span>
    </Badge>
  );
};
