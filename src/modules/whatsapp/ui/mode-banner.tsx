import { FlaskConicalIcon, HandIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { WHATSAPP_COPY as COPY } from "../constants";
import { WhatsappMode } from "../types";

/**
 * The banner every WhatsApp screen shows when sending is not plain
 * automatic: manual mode (nothing leaves on its own) or the sandbox (test
 * numbers only). Nothing in automatic mode.
 */
export const ModeBanner = ({ mode }: { mode: WhatsappMode }) => {
  if (mode === WhatsappMode.Automatic) return null;
  const sandbox = mode === WhatsappMode.Sandbox;

  return (
    <Alert className={sandbox ? "border-warning/40 bg-warning-subtle" : undefined}>
      {sandbox ? <FlaskConicalIcon /> : <HandIcon />}
      <AlertDescription className={sandbox ? "text-warning-strong" : undefined}>
        {sandbox ? COPY.sandboxBanner : COPY.manualBanner}
      </AlertDescription>
    </Alert>
  );
};
