import StatusBadge from "@/components/shared/status-badge";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_TONES } from "../constants";
import type { DocumentType } from "../types";

/** «Facture», «Devis» — label and tone from the slice's maps, one per enum value. */
const DocumentTypeBadge = ({ type }: { type: DocumentType }) => (
  <StatusBadge
    label={DOCUMENT_TYPE_LABELS[type]}
    tone={DOCUMENT_TYPE_TONES[type]}
  />
);

export default DocumentTypeBadge;
