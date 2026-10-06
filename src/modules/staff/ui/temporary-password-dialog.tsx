"use client";

import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { STAFF_COPY } from "../constants";
import type { StaffCreated } from "../types";

interface TemporaryPasswordDialogProps {
  /** `null` ⇒ closed. Dropping it on close is what forgets the password. */
  result: StaffCreated | null;
  onClose: () => void;
}

/**
 * The one moment a temporary password exists in the browser. It is held in
 * the parent's state only while this dialog is open, never in the query cache,
 * and never sent anywhere again. Create and reset share this dialog.
 */
const TemporaryPasswordDialog = ({
  result,
  onClose,
}: TemporaryPasswordDialogProps) => {
  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      toast.success(STAFF_COPY.copied);
    } catch {
      toast.error(STAFF_COPY.copyFailed);
    }
  };

  return (
    <ResponsiveDialog
      title={STAFF_COPY.passwordDialogTitle}
      description={STAFF_COPY.passwordDialogDescription}
      open={result !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-label text-muted-foreground uppercase">
              {STAFF_COPY.passwordFor}
            </span>
            <span className="text-foreground text-sm font-medium">
              {result.user.name}
            </span>
            <span className="text-muted-foreground text-sm">
              {result.user.email}
            </span>
          </div>

          <div className="bg-muted flex items-center justify-between gap-2 rounded-lg border p-2 pl-3">
            <code
              data-testid="temporary-password"
              className="text-foreground min-w-0 font-mono text-base tracking-wider break-all select-all"
            >
              {result.temporaryPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={copy}
              className="shrink-0"
            >
              <CopyIcon />
              {STAFF_COPY.copy}
            </Button>
          </div>

          <p
            role="alert"
            className="bg-warning-subtle text-warning-strong flex items-center gap-2 rounded-lg p-3 text-sm font-medium"
          >
            <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
            {STAFF_COPY.passwordWarning}
          </p>

          <div className="flex justify-end">
            <Button
              type="button"
              size="lg"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              {STAFF_COPY.close}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
};

export default TemporaryPasswordDialog;
