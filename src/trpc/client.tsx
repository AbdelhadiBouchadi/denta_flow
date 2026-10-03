"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  splitLink,
} from "@trpc/client";
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
      links: [
        // FormData (a file upload) cannot ride the batch link, which
        // JSON-encodes every input: it goes alone through `httpLink` as
        // multipart. The server hands the raw FormData to the procedure
        // without the transformer, but the RESPONSE is still superjson — so
        // both links declare it. Must match init.ts and query-client.ts.
        splitLink({
          condition: (op) => isNonJsonSerializable(op.input),
          true: httpLink({ url: getUrl(), transformer: superjson }),
          false: httpBatchLink({ url: getUrl(), transformer: superjson }),
        }),
      ],
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
