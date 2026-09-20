"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { useState } from "react";

import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";
import { env } from "@/lib/env";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;

function getQueryClient() {
  // Server: always fresh.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: singleton. useState() would be discarded if the tree suspends on first render.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  const base = typeof window !== "undefined" ? "" : env.NEXT_PUBLIC_APP_URL;
  return `${base}/api/trpc`;
}

export function TRPCReactProvider(
  props: Readonly<{ children: React.ReactNode }>,
) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      // transformer here — must match init.ts and query-client.ts.
      links: [httpBatchLink({ url: getUrl(), transformer: superjson })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
