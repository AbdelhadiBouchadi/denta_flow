import "server-only";

import { BlobNotFoundError, get, head } from "@vercel/blob";
import { handleUpload, type HandleUploadOptions } from "@vercel/blob/client";

import { env } from "@/lib/env";

/**
 * THE private Blob store (prompts/31, decision 1) — patient radiographs and
 * photos, and nothing else. The only module that reads
 * `PRIVATE_BLOB_READ_WRITE_TOKEN`.
 *
 * Two stores, two jobs: `src/lib/blob.ts` keeps serving the clinic's logo
 * from the PUBLIC store, whose credentials (`VERCEL_OIDC_TOKEN` +
 * `BLOB_STORE_ID`) the SDK reads by itself. Every call here passes the
 * private token EXPLICITLY: in @vercel/blob 2.8 an explicit `token` takes
 * priority over the ambient OIDC credentials (`resolveBlobAuth`), so a
 * patient file can never land in the public store by falling back to them.
 *
 * Nothing here returns a blob URL to a caller that could hand it to a
 * client: rows and procedures expose the file id and `/api/files/{id}` only.
 */

/** The French message both routes and `register` answer without a token. */
export const PRIVATE_STORAGE_NOT_CONFIGURED =
  "Le stockage des images n'est pas configuré.";

export class PrivateStorageNotConfiguredError extends Error {
  constructor() {
    super(PRIVATE_STORAGE_NOT_CONFIGURED);
    this.name = "PrivateStorageNotConfiguredError";
  }
}

/** Optional at boot, required at use. */
export const isPrivateStorageConfigured = () =>
  Boolean(env.PRIVATE_BLOB_READ_WRITE_TOKEN);

const requireToken = () => {
  const token = env.PRIVATE_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new PrivateStorageNotConfiguredError();
  return token;
};

/**
 * Client uploads (decision 4): the browser sends the bytes straight to the
 * store; our server only signs a token scoped to one pathname. The caller's
 * `onBeforeGenerateToken` does every check. `onUploadCompleted` is never
 * passed — it does not fire on localhost, so nothing may depend on it;
 * `imaging.register` verifies the blob with `head()` instead.
 */
export const handlePrivateUpload = (
  options: Pick<HandleUploadOptions, "body" | "request" | "onBeforeGenerateToken">,
) => handleUpload({ ...options, token: requireToken() });

/** The stored blob's metadata, or `null` when nothing is at that pathname. */
export const headPrivateBlob = async (pathname: string) => {
  try {
    return await head(pathname, { token: requireToken() });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
};

/**
 * The blob's bytes as a stream, or `null` when it is gone. `useCache: false`
 * — a private medical image is read from origin storage, never from a shared
 * CDN cache.
 */
export const getPrivateBlob = async (pathname: string) => {
  const result = await get(pathname, {
    access: "private",
    token: requireToken(),
    useCache: false,
  });
  if (!result || result.statusCode !== 200) return null;
  return result;
};
