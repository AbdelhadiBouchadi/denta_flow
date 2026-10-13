"use client";

import { Suspense } from "react";

import LoadingState from "@/components/shared/loading-state";
import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { PRESCRIPTION_COPY as COPY } from "../constants";
import type { PrescriptionPackItem } from "../types";
import { PackForm } from "./pack-form";

interface PackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ «Modifier le pack». */
  initialValues?: PrescriptionPackItem;
}

const PackDialog = ({ open, onOpenChange, initialValues }: PackDialogProps) => (
  <ResponsiveDialog
    title={initialValues ? COPY.editPackTitle : COPY.newPackTitle}
    description={COPY.packDialogDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* The medication picker loads on open, inside the dialog. */}
    <Suspense
      fallback={
        <LoadingState
          title={COPY.loadingTitle}
          description={COPY.loadingDescription}
        />
      }
    >
      <PackForm
        initialValues={initialValues}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </Suspense>
  </ResponsiveDialog>
);

export default PackDialog;
