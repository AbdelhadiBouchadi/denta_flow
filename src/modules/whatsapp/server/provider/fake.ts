import type { MessagingProvider, SendInput, SendResult } from "./types";

/**
 * In-memory provider for tests and fixture runs: records every call and
 * answers from a script (default: accepted with a `fake-…` id).
 */
export const createFakeProvider = (
  script: (
    input: SendInput,
    call: number,
  ) => SendResult | Promise<SendResult> = (_input, call) => ({
    ok: true,
    messageId: `fake-${Date.now()}-${call}`,
  }),
  options: { sandbox?: boolean } = {},
) => {
  const calls: SendInput[] = [];
  const provider: MessagingProvider & { calls: SendInput[] } = {
    channel: "whatsapp_twilio",
    sandbox: options.sandbox ?? false,
    calls,
    async send(input) {
      calls.push(input);
      return script(input, calls.length);
    },
  };
  return provider;
};
