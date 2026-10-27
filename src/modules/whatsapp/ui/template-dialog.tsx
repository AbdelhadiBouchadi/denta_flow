"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { WHATSAPP_COPY as COPY } from "../constants";
import type { WhatsappTemplateItem } from "../types";
import { TemplateForm } from "./template-form";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ «Modifier le modèle». */
  initialValues?: WhatsappTemplateItem;
}

/** «Nouveau modèle» / «Modifier le modèle» — one form, through ResponsiveDialog. */
const TemplateDialog = ({ open, onOpenChange, initialValues }: TemplateDialogProps) => (
  <ResponsiveDialog
    title={initialValues ? COPY.editTemplate : COPY.newTemplate}
    description={COPY.templateDialogDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* Remounted per template, so the form starts from its values. */}
    <TemplateForm
      key={initialValues?.id ?? "new"}
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default TemplateDialog;
