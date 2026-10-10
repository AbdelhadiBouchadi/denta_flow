import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface GenerateDocumentButtonProps {
  icon: ReactNode;
  label: string;
  /** Why the button is disabled; null ⇒ enabled. */
  reason: string | null;
  variant?: "default" | "outline";
  onClick: () => void;
}

/**
 * A document generator, disabled WITH its reason spelled out beneath it — a
 * greyed button alone does not say what is missing, and a tooltip on a
 * disabled button never opens on a touch screen. Shared by the dossier's
 * «Documents» tab and the «Actes» toolbar shortcuts.
 */
const GenerateDocumentButton = ({
  icon,
  label,
  reason,
  variant = "default",
  onClick,
}: GenerateDocumentButtonProps) => (
  <div className="flex flex-col items-end gap-1">
    <Button
      size="lg"
      variant={variant}
      disabled={reason !== null}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
    {reason && <span className="text-muted-foreground text-xs">{reason}</span>}
  </div>
);

export default GenerateDocumentButton;
