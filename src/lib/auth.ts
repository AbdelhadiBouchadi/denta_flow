import "server-only";

import { db } from "@/database";
import * as schema from "@/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    // Flipped to true by the staff branch: staff are then created only by staff.create.
    disableSignUp: false,
  },
  database: drizzleAdapter(db, { provider: "pg", schema: { ...schema } }),
  user: {
    additionalFields: {
      // input: false => a staff member can NEVER set their own role over the wire.
      role: {
        type: "string",
        required: true,
        defaultValue: "assistant",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  plugins: [nextCookies()], // MUST be last
});
