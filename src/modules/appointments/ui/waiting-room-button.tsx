"use client";

import { useState, useSyncExternalStore } from "react";
import { ArmchairIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { WAITING_ROOM_COPY as COPY, waitingRoomCountLabel } from "../constants";
import { useWaitingRoom } from "../hooks/use-waiting-room";
import { WaitingRoomList } from "./waiting-room-list";

const noopSubscribe = () => () => {};

/**
 * False while React hydrates, true afterwards. The layout's prefetch streams
 * a pending promise: depending on timing, the server render and the client's
 * hydration can see it unresolved and resolved — a text mismatch. Reading the
 * count only once hydrated makes both renders print the same placeholder.
 * No request is involved: the data is already in the cache.
 */
const useIsHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * The navbar's «Salle d’attente» button: the count in a pill, always visible
 * — «0» muted when nobody waits, like the Doctopus topbar. Opens the list in
 * a popover on desktop and a bottom drawer on mobile.
 */
export const WaitingRoomButton = () => {
  const isMobile = useIsMobile();
  const isHydrated = useIsHydrated();
  const [open, setOpen] = useState(false);
  const { data } = useWaitingRoom();

  const count = isHydrated ? data?.count : undefined;
  const close = () => setOpen(false);

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2"
      aria-label={
        count === undefined ? COPY.openLabel : waitingRoomCountLabel(count)
      }
    />
  );
  const triggerContent = (
    <>
      <ArmchairIcon />
      <span className="hidden sm:inline">{COPY.title}</span>
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
          count
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count ?? "—"}
      </span>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger render={trigger}>{triggerContent}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{COPY.title}</DrawerTitle>
            <DrawerDescription>{COPY.description}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <WaitingRoomList onNavigate={close} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{triggerContent}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>{COPY.title}</PopoverTitle>
          <PopoverDescription>{COPY.description}</PopoverDescription>
        </PopoverHeader>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto px-4">
          <WaitingRoomList onNavigate={close} />
        </div>
      </PopoverContent>
    </Popover>
  );
};
