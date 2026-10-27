import { FlaskConicalIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { WHATSAPP_COPY as COPY } from "../constants";
import { WhatsappMode } from "../types";

/**
 * The soft «Mode test» banner (prompts/33b, decision 3). Nothing in
 * automatic or manual mode — manual mode has its own card on «Rappels».
 */
export const ModeBanner = ({ mode }: { mode: WhatsappMode }) => {
  if (mode !== WhatsappMode.Sandbox) return null;

  return (
    <Alert className="border-warning/40 bg-warning-subtle">
      <FlaskConicalIcon />
      <AlertDescription className="text-warning-strong">
        {COPY.sandboxBanner}
      </AlertDescription>
    </Alert>
  );
};
