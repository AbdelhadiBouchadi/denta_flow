import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The PDF fonts are read from disk at render time (src/lib/pdf/fonts.ts),
  // which the tracer cannot see from a path string: ship them explicitly with
  // the route handler. `@react-pdf/renderer` itself is already in Next's
  // built-in `serverExternalPackages` list, so it needs no entry here.
  outputFileTracingIncludes: {
    "/api/documents/*": ["./src/lib/pdf/fonts/**/*"],
  },
  async redirects() {
    return [{ source: "/", destination: "/tableau-de-bord", permanent: false }];
  },
};

export default nextConfig;
