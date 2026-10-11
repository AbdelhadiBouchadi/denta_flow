import {
  BanknoteIcon,
  CalendarIcon,
  FileTextIcon,
  SmileIcon,
  StethoscopeIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ACTIVITY_ENTITY_LABELS, ACTIVITY_ENTITY_TONES } from "../constants";
import { ActivityEntityType } from "../types";

/**
 * Lucide has no tooth: actes use the sidebar's own «Actes» icon, so the two
 * screens agree (icons come from lucide-react only, 06-ui.md §8).
 */
const ICONS: Record<ActivityEntityType, LucideIcon> = {
  [ActivityEntityType.Appointment]: CalendarIcon,
  [ActivityEntityType.Treatment]: StethoscopeIcon,
  [ActivityEntityType.Payment]: BanknoteIcon,
  [ActivityEntityType.Document]: FileTextIcon,
  // No tooth in lucide either: the chart reads as the mouth.
  [ActivityEntityType.Odontogram]: SmileIcon,
};

/** The badge palette's tints (06-ui.md §4) — tokens only, never a hex. */
const TINTS = {
  success: "bg-success-subtle text-success-strong",
  warning: "bg-warning-subtle text-warning-strong",
  danger: "bg-danger-subtle text-danger-strong",
  info: "bg-info-subtle text-info-strong",
  neutral: "bg-neutral-subtle text-neutral-strong",
  brand: "bg-teal-light text-teal-dark",
} as const;

interface Props {
  entityType: ActivityEntityType;
  className?: string;
}

/** The timeline's round marker: one icon per entity, in its tint. */
const ActivityEntityIcon = ({ entityType, className }: Props) => {
  // A value outside the enum (a row from a future slice) reads as a document.
  const type = ICONS[entityType] ? entityType : ActivityEntityType.Document;
  const Icon = ICONS[type];

  return (
    <span
      className={cn(
        "ring-background flex size-8 shrink-0 items-center justify-center rounded-full ring-4",
        TINTS[ACTIVITY_ENTITY_TONES[type]],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{ACTIVITY_ENTITY_LABELS[type]}</span>
    </span>
  );
};

export default ActivityEntityIcon;
