import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { headers } from "next/headers";
import superjson from "superjson";

import { auth } from "@/lib/auth";

/** Built once per request. cache() dedupes across the RSC render AND the HTTP handler. */
export const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return { session };
});

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  // MANDATORY — must match client.tsx and query-client.ts. All three or none.
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** TIER 1 — public. Nothing in DentaFlow v1 qualifies. */
export const baseProcedure = t.procedure;

/** TIER 2 — authenticated staff. */
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session expirée. Veuillez vous reconnecter.",
    });
  }
  if (!ctx.session.user.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Ce compte a été désactivé.",
    });
  }
  return next({ ctx: { ...ctx, auth: ctx.session } });
});

/** TIER 3 — administrative. Every remove, and the whole expenses slice. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Action réservée à l'administrateur du cabinet.",
    });
  }
  return next({ ctx });
});
