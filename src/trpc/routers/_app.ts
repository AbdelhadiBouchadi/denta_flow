import { insurersRouter } from "@/modules/insurers/server/procedures";
import { patientsRouter } from "@/modules/patients/server/procedures";
import { tagsRouter } from "@/modules/tags/server/procedures";

import { createTRPCRouter } from "../init";

/**
 * The only place slices are registered — one line each. A procedure defined
 * inline here means the rule has been broken (03-trpc.md §5).
 *
 * The temporary `health.ping` router is gone: it existed only to prove the
 * superjson round-trip until the first slice landed, and `patients.getOne`
 * now returns `createdAt` as a real Date through the same transformer.
 */
export const appRouter = createTRPCRouter({
  patients: patientsRouter,
  tags: tagsRouter,
  insurers: insurersRouter,
});

export type AppRouter = typeof appRouter;
