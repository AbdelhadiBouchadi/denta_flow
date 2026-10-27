import { TWILIO_SANDBOX_NUMBER, type EnvKey } from "./provider-constants";
import { WhatsappMode } from "./types";

/** Presence of each env variable — booleans only, never a value. */
export type EnvPresence = Record<EnvKey, boolean>;

/** Every variable automatic mode needs is set. */
export const isEnvComplete = (presence: EnvPresence) =>
  Object.values(presence).every(Boolean);

/** `TWILIO_WHATSAPP_FROM` is Twilio's shared sandbox sender. */
export const isSandboxSender = (from: string | null | undefined) =>
  !!from && from.trim().replace(/\s/g, "") === `whatsapp:${TWILIO_SANDBOX_NUMBER}`;

/**
 * The mode in effect (prompts/33, decision 9): automatic only when the env is
 * complete AND the global switch is on — otherwise manual, whatever the rest.
 */
export const resolveMode = ({
  presence,
  from,
  enabled,
}: {
  presence: EnvPresence;
  from: string | null | undefined;
  enabled: boolean;
}): WhatsappMode => {
  if (!enabled || !isEnvComplete(presence)) return WhatsappMode.Manual;
  return isSandboxSender(from) ? WhatsappMode.Sandbox : WhatsappMode.Automatic;
};

export const isSendingMode = (mode: WhatsappMode) => mode !== WhatsappMode.Manual;
