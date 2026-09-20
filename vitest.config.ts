import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Pure logic only — formatters, transitions, filter parity. `.ts` and not
    // `.tsx`: a component test would need a DOM environment, and rendering is
    // verified in the browser, not here.
    include: ["src/**/*.test.ts"],
    // The clinic's own machines run Africa/Casablanca. Running the suite in UTC
    // is what makes a helper that leaked the system timezone fail here.
    env: {
      TZ: "UTC",
    },
  },
});
