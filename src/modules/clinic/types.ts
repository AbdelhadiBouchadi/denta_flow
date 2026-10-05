import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

/** The one `clinic_settings` row, as `clinic.get` returns it. */
export type ClinicSettings = inferRouterOutputs<AppRouter>["clinic"]["get"];

/** `{ url }` — the public blob URL of a freshly uploaded asset. */
export type ClinicUploadAsset =
  inferRouterOutputs<AppRouter>["clinic"]["uploadAsset"];

/** Which clinic asset a file is for. English keys — they name blob folders. */
export enum ClinicAssetKind {
  Logo = "logo",
  Letterhead = "letterhead",
}
