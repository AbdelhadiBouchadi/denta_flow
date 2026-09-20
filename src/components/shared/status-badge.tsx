import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The one way a status is rendered.
 *
 * The label is always passed in — it comes from the slice's `constants.ts`
 * label map, never from a French string inlined here. This component only
 * decides the palette, so the same tone reads identically in every slice.
 */
const statusBadgeVariants = cva("text-label border-transparent", {
  variants: {
    tone: {
      success: "bg-success-subtle text-success-strong",
      warning: "bg-warning-subtle text-warning-strong",
      danger: "bg-danger-subtle text-danger-strong",
      info: "bg-info-subtle text-info-strong",
      neutral: "bg-neutral-subtle text-neutral-strong",
      brand: "bg-teal-light text-teal-dark",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

const statusDotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    tone: {
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
      info: "bg-info",
      neutral: "bg-neutral-strong",
      brand: "bg-teal",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  /** Already-French copy, read from the slice's label map. */
  label: string;
  /** The payment family carries a dot; the others do not. */
  withDot?: boolean;
  className?: string;
}

const StatusBadge = ({
  label,
  tone,
  withDot = false,
  className,
}: StatusBadgeProps) => {
  return (
    <Badge className={cn(statusBadgeVariants({ tone }), className)}>
      {withDot && (
        <span aria-hidden="true" className={statusDotVariants({ tone })} />
      )}
      {label}
    </Badge>
  );
};

export default StatusBadge;
