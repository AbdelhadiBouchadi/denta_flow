import { z } from "zod";

import {
  ODONTOGRAM_ENVELOPE_VERSION,
  ODONTOGRAM_MAX_BYTES,
  ODONTOGRAM_MAX_DEPTH,
  ODONTOGRAM_VALIDATION_MESSAGES as M,
} from "./constants";

/**
 * The chart's contract with the server. The library's JSON is OPAQUE
 * (08-clinical.md §2 rule 1): the server checks the envelope around it — our
 * format version, the library version that wrote it, a size cap and a depth
 * sanity check — and never reads a key inside `data`.
 */

/** UTF-8 bytes of the JSON the column will hold. */
export const jsonByteSize = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value) ?? "").length;

/** Nesting depth of a JSON value, iteratively (no stack to blow). */
export const jsonDepth = (value: unknown) => {
  let deepest = 0;
  const stack: [unknown, number][] = [[value, 1]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!;
    if (typeof node !== "object" || node === null) continue;
    deepest = Math.max(deepest, depth);
    if (deepest > ODONTOGRAM_MAX_DEPTH) return deepest;
    for (const child of Object.values(node)) stack.push([child, depth + 1]);
  }
  return deepest;
};

export const odontogramEnvelopeSchema = z
  .strictObject(
    {
      version: z.literal(ODONTOGRAM_ENVELOPE_VERSION, {
        message: M.envelopeVersion,
      }),
      library: z
        .string({ message: M.envelopeInvalid })
        .trim()
        .min(1, { message: M.envelopeInvalid }),
      // An object, never interpreted.
      data: z.record(z.string(), z.unknown(), { message: M.envelopeInvalid }),
    },
    { message: M.envelopeInvalid },
  )
  .superRefine((envelope, ctx) => {
    // Depth first: sizing a pathological value is the cost to avoid.
    if (jsonDepth(envelope) > ODONTOGRAM_MAX_DEPTH) {
      ctx.addIssue({ code: "custom", message: M.tooDeep });
    } else if (jsonByteSize(envelope) > ODONTOGRAM_MAX_BYTES) {
      ctx.addIssue({ code: "custom", message: M.tooLarge });
    }
  });

export type OdontogramEnvelope = z.output<typeof odontogramEnvelopeSchema>;

const patientId = z.string().min(1, { error: M.patientRequired });

export const odontogramByPatientSchema = z.object({ patientId });

/**
 * `expectedUpdatedAt` is the `updatedAt` of the chart the editor loaded, or
 * `null` when it loaded none. Someone else's save since — or a reset, or a
 * first save racing ours — makes the write a CONFLICT, never an overwrite.
 */
export const odontogramSaveSchema = z.object({
  patientId,
  chart: odontogramEnvelopeSchema,
  expectedUpdatedAt: z.date().nullable(),
});

export type OdontogramSaveValues = z.output<typeof odontogramSaveSchema>;
