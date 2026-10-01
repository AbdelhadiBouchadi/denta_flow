import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { EMPTY_FIELD } from "../constants";

interface DetailItemProps {
  label: string;
  /** `null` ⇒ not recorded, shown as a muted dash rather than left blank. */
  value: ReactNode | null;
  /** Keeps the line breaks staff typed into a free-text field. */
  multiline?: boolean;
}

/**
 * A labelled read-only value, shared by the Informations and Dossier médical
 * tabs so the two read identically. Used by one slice only, so it lives here
 * rather than in components/shared (AGENTS.md §4).
 */
const DetailItem = ({ label, value, multiline = false }: DetailItemProps) => {
  const isEmpty = value === null || value === "";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-sm wrap-break-word",
          multiline && "whitespace-pre-wrap",
          isEmpty && "text-muted-foreground",
        )}
      >
        {isEmpty ? EMPTY_FIELD : value}
      </span>
    </div>
  );
};

export default DetailItem;
