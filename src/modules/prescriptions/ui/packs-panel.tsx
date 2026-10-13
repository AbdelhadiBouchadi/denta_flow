"use client";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import EmptyState from "@/components/shared/empty-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { PRESCRIPTION_COPY as COPY } from "../constants";
import { useInvalidatePrescriptions } from "../hooks/use-invalidate-prescriptions";
import { formatMedicationLabel } from "../normalize";
import type { PrescriptionPackItem } from "../types";
import PackDialog from "./pack-dialog";

/**
 * «Packs d’ordonnance»: each pack as a card listing its lines in order. A
 * line whose medication was deactivated stays, flagged — the pack still
 * loads (prompts/29). Editing and deleting are for admins and dentists.
 */
const PacksPanel = ({ canWrite }: { canWrite: boolean }) => {
  const trpc = useTRPC();
  const { data: packs } = useSuspenseQuery(
    trpc.prescriptionPacks.getMany.queryOptions(),
  );
  const [isNewOpen, setIsNewOpen] = useState(false);

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-h4 text-foreground">
            {COPY.packsTitle}
          </h3>
          <p className="text-muted-foreground text-sm">{COPY.packsDescription}</p>
        </div>
        {canWrite && (
          <Button size="lg" variant="outline" onClick={() => setIsNewOpen(true)}>
            <PlusIcon />
            {COPY.addPackButton}
          </Button>
        )}
      </div>

      {packs.length === 0 ? (
        <EmptyState
          title={COPY.emptyPacksTitle}
          description={COPY.emptyPacksDescription}
        />
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {packs.map((pack) => (
            <li key={pack.id} className="min-w-0">
              <PackCard pack={pack} canWrite={canWrite} />
            </li>
          ))}
        </ul>
      )}

      {isNewOpen && <PackDialog open onOpenChange={setIsNewOpen} />}
    </section>
  );
};

const PackCard = ({
  pack,
  canWrite,
}: {
  pack: PrescriptionPackItem;
  canWrite: boolean;
}) => {
  const trpc = useTRPC();
  const invalidate = useInvalidatePrescriptions();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removePackTitle,
    COPY.removePackDescription(pack.name),
    "destructive",
  );
  const remove = useMutation(
    trpc.prescriptionPacks.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.packRemoved);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-lg border p-4">
      <RemoveConfirmation />
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="text-foreground font-medium wrap-break-word">{pack.name}</h4>
          <span className="text-muted-foreground text-xs">
            {COPY.packItemCount(pack.items.length)}
          </span>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${COPY.edit} ${pack.name}`}
              onClick={() => setIsEditOpen(true)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${COPY.removePack} ${pack.name}`}
              disabled={remove.isPending}
              onClick={async () => {
                if (await confirmRemove()) remove.mutate({ id: pack.id });
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </header>

      {pack.notes && (
        <p className="text-muted-foreground text-sm wrap-break-word whitespace-pre-wrap">
          {pack.notes}
        </p>
      )}

      <ol className="flex min-w-0 flex-col gap-2 text-sm">
        {pack.items.map((item, index) => (
          <li key={item.id} className="flex min-w-0 gap-2">
            <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
              {index + 1}.
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {formatMedicationLabel(item.medication)}
                {!item.medication.isActive && (
                  <StatusBadge label={COPY.inactiveMedication} tone="warning" />
                )}
              </span>
              <span className="text-foreground-secondary wrap-break-word">
                {[item.posology, item.duration].filter(Boolean).join(" · ")}
              </span>
              {item.remark && (
                <span className="text-muted-foreground text-xs wrap-break-word">
                  {item.remark}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>

      {isEditOpen && (
        <PackDialog open onOpenChange={setIsEditOpen} initialValues={pack} />
      )}
    </article>
  );
};

export default PacksPanel;
