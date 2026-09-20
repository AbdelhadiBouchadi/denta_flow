import { baseProcedure, createTRPCRouter } from "../init";

/**
 * TEMPORARY — the only router that may live here.
 * It exists to prove the superjson round-trip (`now` must arrive as a real Date)
 * until the first slice lands. Delete it once slices are registered.
 */
const healthRouter = createTRPCRouter({
  ping: baseProcedure.query(() => ({ now: new Date() })),
});

export const appRouter = createTRPCRouter({
  health: healthRouter,
  // Slices are registered here, one line each, as they are built.
});

export type AppRouter = typeof appRouter;
