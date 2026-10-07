import { cn } from "@/lib/utils";
import { NgapReference } from "@/modules/services/ui/ngap-reference";
import type { TreatmentListItem } from "../types";

/**
 * The acte's label, with the muted «D × 10 · Réf. …» line under it when its
 * snapshotted code is an NGAP act. The NGAP data came from the server.
 *
 * NGAP wordings run long: the label is clamped to two lines, the full text in
 * `title`. The width is the caller's to bound.
 */
export const TreatmentLabel = ({
  treatment,
  struck = false,
}: {
  treatment: Pick<TreatmentListItem, "label" | "nomenclatureCode" | "ngap">;
  /** A cancelled acte: kept in the history, struck through. */
  struck?: boolean;
}) => (
  <span className="flex min-w-0 flex-col gap-0.5">
    <span
      title={
        treatment.nomenclatureCode
          ? `${treatment.nomenclatureCode} ${treatment.label}`
          : treatment.label
      }
      className={cn(
        "line-clamp-2 font-medium",
        struck ? "text-muted-foreground line-through" : "text-foreground",
      )}
    >
      {treatment.nomenclatureCode && (
        <span className="text-muted-foreground mr-1.5 font-mono text-xs">
          {treatment.nomenclatureCode}
        </span>
      )}
      {treatment.label}
    </span>
    {treatment.ngap && (
      <NgapReference
        letter={treatment.ngap.letter}
        coefficient={treatment.ngap.coefficient}
        referenceTariffCents={treatment.ngap.referenceTariffCents}
        onQuote={treatment.ngap.onQuote}
      />
    )}
  </span>
);
