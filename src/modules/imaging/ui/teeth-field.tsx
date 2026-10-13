"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToothSelect } from "@/modules/treatments/ui/tooth-select";
import { IMAGING_COPY as COPY } from "../constants";

interface TeethFieldProps {
  id: string;
  value: string[];
  onChange: (teeth: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The COMPACT «Dents» field of an upload row (prompts/32, decision 8): a
 * one-line trigger listing the picked codes, opening the actes'
 * `ToothSelect` (multi) in a popover — ten rows of full grids would not fit
 * a 768 px screen. Controlled, inside a react-hook-form `Controller`.
 */
export const TeethField = ({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: TeethFieldProps) => (
  <Popover>
    <PopoverTrigger
      render={
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className="h-9 w-full min-w-0 justify-between font-normal tabular-nums"
        />
      }
    >
      <span className={value.length === 0 ? "text-muted-foreground truncate" : "truncate"}>
        {value.length === 0 ? COPY.noTeeth : value.join(", ")}
      </span>
      <ChevronDownIcon className="text-muted-foreground" />
    </PopoverTrigger>
    <PopoverContent
      align="start"
      className="w-[min(24rem,calc(100vw-2rem))] p-2"
    >
      <ToothSelect
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={invalid}
      />
    </PopoverContent>
  </Popover>
);
