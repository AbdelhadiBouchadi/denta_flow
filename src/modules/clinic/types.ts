import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/** `{ url }` — the public blob URL of a freshly uploaded asset. */
export type ClinicUploadAsset =
  inferRouterOutputs<AppRouter>["clinic"]["uploadAsset"];

/** Which clinic asset a file is for. English keys — they name blob folders. */
export enum ClinicAssetKind {
  Logo = "logo",
  Letterhead = "letterhead",
}
