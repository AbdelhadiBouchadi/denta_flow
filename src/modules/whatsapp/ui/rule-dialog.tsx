"use client";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { WHATSAPP_COPY as COPY } from "../constants";
import type { WhatsappRuleItem } from "../types";
import { RuleForm } from "./rule-form";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ «Modifier la règle». */
  initialValues?: WhatsappRuleItem;
}

const RuleDialog = ({ open, onOpenChange, initialValues }: RuleDialogProps) => (
  <ResponsiveDialog
    title={initialValues ? COPY.editRule : COPY.addRule}
    description={COPY.ruleDialogDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    <RuleForm
      key={initialValues?.id ?? "new"}
      initialValues={initialValues}
      onSuccess={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  </ResponsiveDialog>
);

export default RuleDialog;
