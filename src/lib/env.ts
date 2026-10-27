import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    DATABASE_URL_POOLED: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    BOOTSTRAP_ADMIN_EMAIL: z.email(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(6),
    // The PRIVATE Blob store for patient images (prompts/31). Optional at
    // boot — the app must start without it — and required at use: the
    // imaging routes answer «Le stockage des images n'est pas configuré.»
    // when it is missing. Read only by src/lib/storage/private.ts.
    PRIVATE_BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    // WhatsApp automation through Twilio (prompts/33). Optional at boot —
    // every other feature works without them — and all required for the
    // automatic mode; missing ⇒ manual mode. The auth token is read only by
    // src/modules/whatsapp/server/provider/twilio-env.ts.
    TWILIO_ACCOUNT_SID: z.string().regex(/^AC[0-9a-fA-F]{32}$/).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    // `whatsapp:+14155238886` (the shared sandbox) or the clinic's sender.
    TWILIO_WHATSAPP_FROM: z
      .string()
      .regex(/^whatsapp:\+[1-9]\d{7,14}$/)
      .optional(),
    // Sent by Vercel Cron as `Authorization: Bearer <CRON_SECRET>`.
    CRON_SECRET: z.string().min(16).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    // One clinic per deployment (AGENTS.md §2), so the practice name is
    // configuration and not a database row. Defaulted rather than required:
    // a deployment that forgets it must still boot.
    NEXT_PUBLIC_CLINIC_NAME: z.string().min(1).default("DentaFlow"),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLINIC_NAME: process.env.NEXT_PUBLIC_CLINIC_NAME,
  },
});
