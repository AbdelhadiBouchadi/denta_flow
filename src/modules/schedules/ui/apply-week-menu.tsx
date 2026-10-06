"use client";

import { useMutation } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { applyWeekConfirmDescription, WEEK_COPY } from "../constants";
import { useInvalidateSchedules } from "../hooks/use-invalidate-schedules";
import type { Practitioner } from "../types";
import type { WeekRange } from "../week";

interface ApplyWeekMenuProps {
  /** Every practitioner except the one whose week is on screen. */
  targets: Practitioner[];
  /**
   * The week as currently edited, validated — or null when the form holds an
   * invalid range (the form then shows the errors itself).
   */
  getValidRanges: () => Promise<WeekRange[] | null>;
  disabled?: boolean;
}

/**
 * «Appliquer la semaine à…»: overwrites another practitioner's whole week
 * with the one on screen, through the same atomic `setWeek`. The target's
 * current hours are lost, so it is confirmed by name.
 */
export const ApplyWeekMenu = ({
  targets,
  getValidRanges,
  disabled,
}: ApplyWeekMenuProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateSchedules();
  const [target, setTarget] = useState<Practitioner | null>(null);

  const [ConfirmApply, confirmApply] = useConfirm(
    WEEK_COPY.applyWeekConfirmTitle,
    applyWeekConfirmDescription(target?.name ?? ""),
  );

  const applyWeek = useMutation(
    trpc.schedules.setWeek.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(WEEK_COPY.applyWeekDone);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const handleSelect = async (practitioner: Practitioner) => {
    const ranges = await getValidRanges();
    if (!ranges) {
      toast.error(WEEK_COPY.invalid);
      return;
    }

    setTarget(practitioner);
    if (!(await confirmApply())) return;
    applyWeek.mutate({ practitionerId: practitioner.id, ranges });
  };

  return (
    <>
      <ConfirmApply />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={disabled || applyWeek.isPending}
              className="w-full sm:w-auto"
            />
          }
        >
          <UsersIcon />
          {applyWeek.isPending
            ? WEEK_COPY.applyWeekApplying
            : WEEK_COPY.applyWeek}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{WEEK_COPY.applyWeekTarget}</DropdownMenuLabel>
            {targets.length === 0 ? (
              <DropdownMenuItem disabled>
                {WEEK_COPY.applyWeekNoTarget}
              </DropdownMenuItem>
            ) : (
              targets.map((practitioner) => (
                <DropdownMenuItem
                  key={practitioner.id}
                  onClick={() => void handleSelect(practitioner)}
                >
                  {practitioner.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
