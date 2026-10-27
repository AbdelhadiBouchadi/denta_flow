// scripts/dev-cron.ts   —   DEV ONLY
//
//   npm run dev:cron            (next to `npm run dev`, in a second terminal)
//
// Calls the WhatsApp cron route every 30 seconds with the configured
// CRON_SECRET, exactly as the hosting platform's scheduler does — so
// automatic sending (and the template approval refresh) can be tested
// locally, without Vercel. Stop it with Ctrl+C.
//
// Reads CRON_SECRET from .env.local, then .env. Calls
// http://localhost:${PORT:-3000}/api/cron/whatsapp unless DEV_CRON_URL is set.
// Prints the route's summary — counts only, never a number or a message.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const INTERVAL_MS = 30_000;

const main = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev only: refuses to run with NODE_ENV=production.");
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "CRON_SECRET is not set. Generate one with `npm run secrets:generate` and put it in .env.local.",
    );
  }
  const url =
    process.env.DEV_CRON_URL ??
    `http://localhost:${process.env.PORT ?? "3000"}/api/cron/whatsapp`;

  const tick = async () => {
    const at = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
      });
      const body = await response.text();
      console.log(`[${at}] HTTP ${response.status} ${body}`);
      if (response.status === 401) {
        console.log("  → 401: the app's CRON_SECRET differs from this one (restart `npm run dev` after editing .env.local).");
      }
    } catch (error) {
      console.log(
        `[${at}] unreachable (${error instanceof Error ? error.message : error}) — is \`npm run dev\` running?`,
      );
    }
  };

  console.log(`dev:cron → ${url} every ${INTERVAL_MS / 1000} s. Ctrl+C to stop.`);
  await tick();
  setInterval(() => void tick(), INTERVAL_MS);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
