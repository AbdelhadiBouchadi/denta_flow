"use client";

import { ChevronDownIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { IMAGING_COPY as COPY } from "../constants";
import type { ImagingGroup } from "../gallery";
import type { ImagingFile } from "../types";
import ImagingTile from "./imaging-tile";

/** 2 columns at 360 px, 3 on `md`, 4 on `xl`, 5 beyond. */
export const IMAGING_GRID =
  "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

interface ImagingGroupsProps {
  groups: ImagingGroup<ImagingFile>[];
  /** Keys of the folded groups — in-memory view state of the tab. */
  collapsed: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onActivate: (file: ImagingFile) => void;
  selectable: boolean;
  selectedIds: readonly string[];
}

/**
 * The grid, one collapsible section per group (prompts/32, decision 2). The
 * header sticks under the site header while its group scrolls by — sticky
 * inside its own section, so the next group's header pushes it away.
 */
const ImagingGroups = ({
  groups,
  collapsed,
  onToggleGroup,
  onActivate,
  selectable,
  selectedIds,
}: ImagingGroupsProps) => (
  <div className="flex flex-col gap-2">
    {groups.map((group) => {
      const open = !collapsed.has(group.key);
      return (
        <Collapsible
          key={group.key}
          open={open}
          onOpenChange={() => onToggleGroup(group.key)}
          render={<section aria-label={COPY.groupToggle(group.label, group.files.length)} />}
        >
          <CollapsibleTrigger
            className="bg-background focus-visible:ring-ring sticky top-(--header-height) z-[5] flex w-full items-center gap-2 py-2 text-left outline-none focus-visible:ring-2"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                !open && "-rotate-90",
              )}
            />
            <span suppressHydrationWarning className="min-w-0 truncate text-sm font-semibold">
              {group.label}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {COPY.groupCount(group.files.length)}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className={cn(IMAGING_GRID, "pt-1 pb-3")}>
              {group.files.map((file) => (
                <li key={file.id} className="min-w-0">
                  <ImagingTile
                    file={file}
                    onActivate={() => onActivate(file)}
                    selectable={selectable}
                    selected={selectedIds.includes(file.id)}
                  />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      );
    })}
  </div>
);

export default ImagingGroups;
