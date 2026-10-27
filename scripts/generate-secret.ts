// scripts/generate-secret.ts
//
//   npm run secrets:generate
//
// Prints a fresh random value for CRON_SECRET: 32 random bytes, base64url
// (43 characters, no padding, safe in an HTTP header and a .env file).
// Nobody issues this secret — not Twilio, not Vercel: generate it once and
// put the SAME value in .env.local and in the hosting environment variables
// (docs/deploy/whatsapp-setup.md).
import { randomBytes } from "node:crypto";

console.log(randomBytes(32).toString("base64url"));
