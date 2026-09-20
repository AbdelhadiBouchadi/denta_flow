"use client";

import * as React from "react";

import { Command } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

interface CommandResponsiveDialogProps {
  title?: string;
  description?: string;
  open: boolean;
  /**
   * Declared with a single parameter on purpose: Dialog and Drawer pass
   * incompatible event-detail objects as their second argument, and a narrower
   * handler stays assignable to both.
   */
  onOpenChange: (open: boolean) => void;
  /** false when the caller filters server-side. */
  shouldFilter?: boolean;
  children: React.ReactNode;
}

const CommandResponsiveDialog = ({
  title = "Recherche",
  description = "Recherchez puis sélectionnez une option dans la liste.",
  open,
  onOpenChange,
  shouldFilter = true,
  children,
}: CommandResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="overflow-hidden p-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <Command shouldFilter={shouldFilter}>{children}</Command>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
        showCloseButton={false}
      >
        {/* Inside the popup, not beside it, so the accessible name binds to it. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={shouldFilter}>{children}</Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandResponsiveDialog;
