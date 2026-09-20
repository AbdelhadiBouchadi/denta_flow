"use client";

import React, { useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import CommandResponsiveDialog from "./command-responsive-dialog";

type Props = {
  options: Array<{
    id: string;
    value: string;
    children: React.ReactNode;
  }>;
  onSelect: (value: string) => void;
  /** Present ⇒ the caller filters server-side, so cmdk must not filter too. */
  onSearch?: (value: string) => void;
  value: string;
  placeholder?: string;
  className?: string;
};

const CommandSelect = ({
  options,
  onSelect,
  onSearch,
  value,
  placeholder = "Sélectionner une option",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const handleOpenChange = (nextOpen: boolean) => {
    onSearch?.("");
    setOpen(nextOpen);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-9 justify-between px-2 font-normal",
          !selectedOption && "text-muted-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <div>{selectedOption?.children ?? placeholder}</div>
        <ChevronsUpDownIcon />
      </Button>
      <CommandResponsiveDialog
        shouldFilter={!onSearch}
        open={open}
        onOpenChange={handleOpenChange}
      >
        <CommandInput placeholder="Rechercher…" onValueChange={onSearch} />
        <CommandList>
          <CommandEmpty>
            <span className="text-muted-foreground text-sm">
              Aucune option trouvée.
            </span>
          </CommandEmpty>
          {options.map((option) => (
            <CommandItem
              key={option.id}
              data-checked={option.value === value}
              onSelect={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.children}
            </CommandItem>
          ))}
        </CommandList>
      </CommandResponsiveDialog>
    </>
  );
};

export default CommandSelect;
