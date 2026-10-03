import { z } from "zod";

import { CLINIC_ASSET_ERRORS } from "./constants";
import { ClinicAssetKind } from "./types";

/**
 * The fields `clinic.uploadAsset` reads out of its FormData. The procedure's
 * `.input()` is `z.instanceof(FormData)` — FormData cannot be described field
 * by field at the wire — so this schema parses the entries inside it.
 *
 * Size, MIME and magic-byte checks are not here: they need the bytes, and
 * each maps to its own error code.
 */
export const clinicAssetUploadSchema = z.object({
  kind: z.enum(ClinicAssetKind, { message: CLINIC_ASSET_ERRORS.invalidKind }),
  file: z.instanceof(File, { message: CLINIC_ASSET_ERRORS.missingFile }),
});
