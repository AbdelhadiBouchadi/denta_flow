import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// cache() keeps one instance per request, so the prefetch and dehydrate() share a cache.
export const getQueryClient = cache(makeQueryClient);

// Calls procedures in-process — no HTTP hop.
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});
