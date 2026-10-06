import { formatDH } from "@/lib/format";
import { formatNgapCotation, NGAP_COPY } from "../constants";

interface NgapReferenceProps {
  letter: string;
  coefficient: number;
  referenceTariffCents: number;
  onQuote: boolean;
}

/**
 * «D × 10 · Réf. 175,00 DH» — the muted line under an NGAP act, in the table,
 * the picker and the import list. Information only: never the clinic's fee.
 */
export const NgapReference = ({
  letter,
  coefficient,
  referenceTariffCents,
  onQuote,
}: NgapReferenceProps) => (
  <span className="text-muted-foreground text-xs tabular-nums">
    {formatNgapCotation(letter, coefficient)} · {NGAP_COPY.referenceShort}{" "}
    {onQuote ? NGAP_COPY.onQuote : formatDH(referenceTariffCents)}
  </span>
);
