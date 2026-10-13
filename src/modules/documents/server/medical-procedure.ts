import "server-only";

import { TRPCError } from "@trpc/server";

import { protectedProcedure } from "@/trpc/init";
import { medicalWriteDenial } from "../rules";

/**
 * A procedure only an admin or a dentist may call (prompts/29, decision 3):
 * writing an ordonnance or a certificat, and managing the medications, packs
 * and certificate templates behind them.
 *
 * The role is read from the SESSION and checked here — never in the UI, never
 * in proxy.ts (AGENTS.md §1 rule 5). Chained BEFORE `.input()`, so an
 * assistant or a secretary is told FORBIDDEN, in French, whatever they sent —
 * not a validation error that would hint the call could succeed.
 */
export const medicalWriterProcedure = protectedProcedure.use(({ ctx, next }) => {
  const denial = medicalWriteDenial(ctx.auth.user.role);
  if (denial) throw new TRPCError({ code: "FORBIDDEN", message: denial });
  return next({ ctx });
});
