"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { CERTIFICATE_COPY as COPY } from "../constants";
import type { CertificateTemplateItem } from "../types";
import { TemplateForm } from "./template-form";

interface UpdateTemplateDialogProps {
  template: CertificateTemplateItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Edit only — V1 has no template creator (prompts/29). */
const UpdateTemplateDialog = ({
  template,
  open,
  onOpenChange,
}: UpdateTemplateDialogProps) => (
  <ResponsiveDialog
    title={COPY.editTitle}
    description={COPY.editDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <TemplateForm
      template={template}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default UpdateTemplateDialog;
