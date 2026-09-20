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
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
