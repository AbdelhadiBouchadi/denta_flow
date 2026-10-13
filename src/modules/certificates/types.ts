import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database (AGENTS.md §1 rule 6): never a
 * hand-written `interface CertificateTemplate`.
 */
export type CertificateTemplateItem =
  inferRouterOutputs<AppRouter>["certificateTemplates"]["getMany"][number];
