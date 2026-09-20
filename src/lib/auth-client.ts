import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

// Sign-in, sign-out and the session hook in the navbar — nothing else.
// All clinical and financial data goes through tRPC.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
