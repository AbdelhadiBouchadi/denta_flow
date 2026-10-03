import "server-only";

import { del, put } from "@vercel/blob";

import { ASSET_FILE_EXTENSIONS, type AssetMimeType } from "@/constants";

/**
 * The only module that touches `@vercel/blob`. The SDK reads its own
 * credentials (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`); nothing here reads,
 * passes or validates them.
 *
 * The store is public, so `access` must be `"public"` — the SDK rejects a
 * mismatch with the store's own setting.
 */

/**
 * Stores `file` under `clinic/<kind>.<ext>` with a random suffix, so a replaced
 * asset never overwrites a URL a cached page may still point at. `contentType`
 * is the **sniffed** type, never the client-declared one. Returns the public URL.
 */
export async function uploadAsset(
  kind: string,
  file: Blob,
  contentType: AssetMimeType,
): Promise<string> {
  const [extension] = ASSET_FILE_EXTENSIONS[contentType];
  const blob = await put(`clinic/${kind}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return blob.url;
}

export async function deleteAsset(url: string): Promise<void> {
  await del(url);
}
