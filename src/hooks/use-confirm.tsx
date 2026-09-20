"use client";

import { useState } from "react";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";

type ConfirmVariant = "default" | "destructive";

/**
 * The single confirmation path for destructive actions. One copy, never
 * duplicated into a slice.
 *
 * The description is the whole point: it must name the cascade in French —
 * what else disappears with the record — because that is what the receptionist
 * reads before deciding.
 *
 * Closing the dialog by any other means (escape, overlay, drawer swipe)
 * resolves `false`, so an awaited `confirm()` never hangs.
 */
export const useConfirm = (
  title: string,
  description: string,
  variant: ConfirmVariant = "default",
) => {
  const [promise, setPromise] = useState<{
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = (): Promise<boolean> =>
    new Promise((resolve) => {
      promise?.resolve(false);
      setPromise({ resolve });
    });

  const settle = (value: boolean) => {
    promise?.resolve(value);
    setPromise(null);
  };

  const ConfirmationDialog = () => (
    <ResponsiveDialog
      open={promise !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={title}
      description={description}
    >
      <div className="flex w-full flex-col-reverse items-center justify-end gap-2 pt-4 lg:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full lg:w-auto"
          onClick={() => settle(false)}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant={variant}
          size="lg"
          className="w-full lg:w-auto"
          onClick={() => settle(true)}
        >
          Confirmer
        </Button>
      </div>
    </ResponsiveDialog>
  );

  return [ConfirmationDialog, confirm] as const;
};
