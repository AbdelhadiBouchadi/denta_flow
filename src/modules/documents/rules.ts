import { TreatmentStatus } from "@/modules/treatments/types";
import { DOCUMENT_SERVER_ERRORS } from "./constants";
import { DocumentType, type GeneratedDocumentType } from "./types";

/**
 * Which actes a document may name — pure, shared by the generate dialog (what
 * it offers) and the procedure (what it accepts), and covered by Vitest.
 *
 * - A FACTURE names billable actes only: the shared rule of
 *   src/database/sql/billable.ts (in progress or completed). That module
 *   builds SQL and stays on the server, so the statuses are restated here
 *   and a test keeps the two in lockstep. `planned` and `canceled` never
 *   appear on an invoice.
 * - A DEVIS names `planned` actes only, and never mentions payments.
 */
export const DOCUMENT_ELIGIBLE_STATUSES: Record<
  GeneratedDocumentType,
  readonly TreatmentStatus[]
> = {
  [DocumentType.Invoice]: [TreatmentStatus.InProgress, TreatmentStatus.Completed],
  [DocumentType.Quote]: [TreatmentStatus.Planned],
};

export const isEligibleForDocument = (
  type: GeneratedDocumentType,
  status: string,
) => (DOCUMENT_ELIGIBLE_STATUSES[type] as readonly string[]).includes(status);

/** The fields of an acte the rule reads. */
interface Candidate {
  id: string;
  patientId: string;
  status: string;
}

export type SelectionError = keyof Pick<
  typeof DOCUMENT_SERVER_ERRORS,
  "emptySelection" | "notOwned" | "notBillable" | "notPlanned"
>;

export type SelectionResult<T extends Candidate> =
  | { ok: true; lines: T[] }
  | { ok: false; error: SelectionError };

/**
 * The requested ids against the rows the database returned for them (any
 * patient's — so a foreign id is caught, not silently dropped). Duplicates
 * collapse. The lines come back in the requested order.
 */
export const selectDocumentLines = <T extends Candidate>({
  type,
  patientId,
  requestedIds,
  rows,
}: {
  type: GeneratedDocumentType;
  patientId: string;
  requestedIds: readonly string[];
  rows: readonly T[];
}): SelectionResult<T> => {
  const ids = [...new Set(requestedIds)];
  if (ids.length === 0) return { ok: false, error: "emptySelection" };

  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || row.patientId !== patientId) {
      return { ok: false, error: "notOwned" };
    }
    if (!isEligibleForDocument(type, row.status)) {
      return {
        ok: false,
        error: type === DocumentType.Invoice ? "notBillable" : "notPlanned",
      };
    }
    lines.push(row);
  }
  return { ok: true, lines };
};

/**
 * The dialog's preview total. Display only: the procedure recomputes the
 * printed total from the database rows and never reads this.
 */
export const sumSelectedCents = (
  items: readonly { id: string; totalAmountCents: number }[],
  selectedIds: readonly string[],
) => {
  const selected = new Set(selectedIds);
  return items.reduce(
    (sum, item) => (selected.has(item.id) ? sum + item.totalAmountCents : sum),
    0,
  );
};
