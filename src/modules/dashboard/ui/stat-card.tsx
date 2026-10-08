import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint: string;
}

/** One KPI: an icon, a label, the figure, a short hint under it. */
export const StatCard = ({ icon: Icon, label, value, hint }: StatCardProps) => (
  <Card className="flex-row items-start gap-4 px-4">
    <span
      aria-hidden="true"
      className="bg-teal-light text-teal-dark flex size-10 shrink-0 items-center justify-center rounded-lg"
    >
      <Icon className="size-5" />
    </span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-heading text-h3 text-foreground tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  </Card>
);
