"use client";

import { useMutation } from "@tanstack/react-query";
import { RotateCcwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { WHATSAPP_COPY as COPY } from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import type { WhatsappDayRow } from "../types";

/**
 * Records a manual send. The link itself opens from the user's click — a
 * real `<a target="_blank">`, never a `window.open` after an await, which a
 * popup blocker would swallow — and the row becomes «Ouvert (manuel)».
 */
export const useOpenManual = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  return useMutation(
    trpc.whatsapp.openManual.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.opened);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
};

interface RappelActionsProps {
  row: Pick<WhatsappDayRow, "messageId" | "waLink" | "canRetry">;
  /**
   * `work` — manual mode, the page is a to-do list: «Envoyer sur WhatsApp».
   * `rescue` — automatic or test mode: a small «Envoyer manuellement» on the
   * rows the server still offers (failed, to check, fixable skip).
   */
  variant?: "work" | "rescue";
}

export const RappelActions = ({ row, variant = "work" }: RappelActionsProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const openManual = useOpenManual();
  const retry = useMutation(
    trpc.whatsapp.retry.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.retried);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const messageId = row.messageId;
  if (!messageId || (!row.waLink && !row.canRetry)) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2"
      // The table row is clickable elsewhere; actions must not bubble.
      onClick={(event) => event.stopPropagation()}
    >
      {row.waLink && (
        <a
          href={row.waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={openManual.isPending}
          onClick={() => openManual.mutate({ id: messageId })}
          className={cn(
            buttonVariants({
              variant: variant === "work" ? "outline" : "ghost",
              size: variant === "work" ? "sm" : "xs",
            }),
          )}
        >
          <SendIcon />
          {variant === "work" ? COPY.sendOnWhatsapp : COPY.sendManually}
        </a>
      )}
      {row.canRetry && (
        <Button
          variant="outline"
          size="sm"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ id: messageId })}
        >
          <RotateCcwIcon />
          {COPY.retry}
        </Button>
      )}
    </div>
  );
};
