import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/**
 * Types flow upward from the database: schema → Drizzle inference → procedure
 * return → here → props (AGENTS.md §1 rule 6). No blob field exists on any of
 * them: the client knows a file by its id and `/api/files/{id}` only.
 */
type ImagingOutputs = inferRouterOutputs<AppRouter>["imaging"];

export type ImagingList = ImagingOutputs["getManyByPatient"];

/** One gallery tile / viewer page. */
export type ImagingFile = ImagingList["items"][number];

/** Mirrors the `patient_file_kind` pgEnum, kept in lockstep. */
export enum PatientFileKind {
  Panoramic = "panoramic",
  Periapical = "periapical",
  Cephalometric = "cephalometric",
  Photo = "photo",
  Other = "other",
}

/** The types the private store accepts — originals as uploaded, never re-encoded. */
export enum ImageContentType {
  Jpeg = "image/jpeg",
  Png = "image/png",
  Webp = "image/webp",
}
