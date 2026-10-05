import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Staff` is a bug
 * (AGENTS.md §1 rule 6).
 */
export type StaffGetMany =
  inferRouterOutputs<AppRouter>["staff"]["getMany"]["items"];

export type StaffListItem = StaffGetMany[number];

/** `{ user, temporaryPassword }` — the password is shown once, never again. */
export type StaffCreated = inferRouterOutputs<AppRouter>["staff"]["create"];

/** Mirrors the `staff_role` pgEnum, kept in lockstep. */
export enum StaffRole {
  Admin = "admin",
  Dentist = "dentist",
  Assistant = "assistant",
  Secretary = "secretary",
}

/**
 * A change one staff member makes to another's account. The guards in
 * `guards.ts` decide which of them an admin may not make to themselves.
 */
export enum StaffChange {
  Demote = "demote",
  Deactivate = "deactivate",
}
