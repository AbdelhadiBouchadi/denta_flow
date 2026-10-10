"use client";

import { TriangleAlertIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMedicalAlertDetails } from "@/lib/medical-alert";
import { cn } from "@/lib/utils";

const COPY = {
  pill: "Alerte médicale",
  allergies: "Allergies",
  medicalNotes: "Notes médicales",
} as const;

type MedicalAlertBadgeProps =
  | {
      /**
       * The dossier: the full pill, reading the text itself. Renders nothing
       * when both fields are empty or whitespace only.
       */
      compact?: false;
      allergies: string | null;
      medicalNotes: string | null;
      className?: string;
    }
  | {
      /**
       * A list row: the icon alone, from the `hasMedicalAlert` boolean the
       * server computed in SQL — a list never carries the text.
       */
      compact: true;
      active: boolean;
      className?: string;
    };

/**
 * «ALERTE MÉDICALE» — one component wherever a clinician acts on a patient
 * (prompts/25). The full pill opens on hover AND on tap (Base UI's popover
 * trigger does both), since a fact that changes what may safely be done must
 * not depend on a hover a touch screen cannot make.
 */
const MedicalAlertBadge = (props: MedicalAlertBadgeProps) => {
  if (props.compact) {
    if (!props.active) return null;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="img"
              aria-label={COPY.pill}
              className={cn(
                "text-destructive focus-visible:ring-ring/50 inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-3",
                props.className,
              )}
            />
          }
        >
          <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{COPY.pill}</TooltipContent>
      </Tooltip>
    );
  }

  const details = getMedicalAlertDetails(props);
  if (!details) return null;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        render={
          <button
            type="button"
            className={cn(
              "border-danger/30 bg-danger-subtle text-danger-strong text-label focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 uppercase outline-none focus-visible:ring-3",
              props.className,
            )}
          />
        }
      >
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {COPY.pill}
      </PopoverTrigger>
      {/* Never wider than the screen, whatever the note's length: the text
          wraps, long unbroken words included. */}
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <PopoverHeader>
          <PopoverTitle className="text-danger-strong flex items-center gap-1.5">
            <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
            {COPY.pill}
          </PopoverTitle>
        </PopoverHeader>
        {details.allergies && (
          <AlertSection title={COPY.allergies} text={details.allergies} />
        )}
        {details.medicalNotes && (
          <AlertSection title={COPY.medicalNotes} text={details.medicalNotes} />
        )}
      </PopoverContent>
    </Popover>
  );
};

const AlertSection = ({ title, text }: { title: string; text: string }) => (
  <section className="flex flex-col gap-0.5">
    <h3 className="text-muted-foreground text-label">{title}</h3>
    <p className="text-sm break-words whitespace-pre-wrap">{text}</p>
  </section>
);

export default MedicalAlertBadge;
