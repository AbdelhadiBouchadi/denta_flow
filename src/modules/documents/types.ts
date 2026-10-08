import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props. A hand-written `interface Document` is a bug
 * (AGENTS.md §1 rule 6). The snapshot's type is inferred from its zod schema
 * (snapshot.ts), the one contract the renderer reads through.
 */
type DocumentsOutputs = inferRouterOutputs<AppRouter>["documents"];

/** One row of `/documents` and of the dossier tab — one shape, no snapshot. */
export type DocumentListItem = DocumentsOutputs["getMany"]["items"][number];

/**
 * Mirrors the `document_type` pgEnum, kept in lockstep (rules.test.ts). Only
 * `Invoice` and `Quote` are generated today; the V1.1 / V1.2 types are listed
 * so the label map covers the enum, and never offered in any UI.
 */
export enum DocumentType {
  Invoice = "facture",
  Quote = "devis",
  CareSheet = "feuille_de_soins",
  Prescription = "ordonnance",
  Certificate = "certificat",
}

/** The types this branch generates: the snapshot and the filter accept these only. */
export type GeneratedDocumentType = DocumentType.Invoice | DocumentType.Quote;
