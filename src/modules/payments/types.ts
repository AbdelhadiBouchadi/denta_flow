import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Payment` is a bug
 * (AGENTS.md §1 rule 6).
 */
type PaymentsOutputs = inferRouterOutputs<AppRouter>["payments"];

/** One row of `/paiements`, of the dossier tab and of `getOne` — one shape. */
export type PaymentListItem = PaymentsOutputs["getMany"]["items"][number];

export type PaymentGetOne = PaymentsOutputs["getOne"];

export type PaymentSummary = PaymentsOutputs["getSummary"];

/** `create` / `update` answer: saved, or an advance waiting for confirmation. */
export type PaymentWriteResult = PaymentsOutputs["create"];

/** Mirrors the `payment_method` pgEnum, kept in lockstep (rules.test.ts). */
export enum PaymentMethod {
  Cash = "cash",
  Check = "check",
  Card = "card",
  Transfer = "transfer",
  /** A reimbursement; always carries an `insurerId` (08-clinical.md §3). */
  Insurance = "insurance",
}
