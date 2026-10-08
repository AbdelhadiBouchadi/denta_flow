"use client";

import { useMutation } from "@tanstack/react-query";
import {
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import { formatDH } from "@/lib/format";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { useTRPC } from "@/trpc/client";
import { PAYMENT_COPY as COPY } from "../constants";
import { useInvalidatePayments } from "../hooks/use-invalidate-payments";
import type { PaymentListItem } from "../types";
import UpdatePaymentDialog from "./update-payment-dialog";

interface PaymentActionsProps {
  payment: PaymentListItem;
  /** The clinic-wide list links to the dossier; the dossier itself does not. */
  showDossierLink?: boolean;
}

/**
 * A row's menu: «Modifier» where the server would accept it (`canEdit`,
 * computed by the procedure from the same rule `update` enforces), the
 * dossier link, and the admin's delete. All cosmetic: `update` and `remove`
 * re-check on the server (AGENTS.md §2).
 */
const PaymentActions = ({
  payment,
  showDossierLink = false,
}: PaymentActionsProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const invalidateAll = useInvalidatePayments();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  // Names the effect on the balance before the admin decides.
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.removeTitle,
    COPY.removeDescription(formatDH(payment.amountCents)),
    "destructive",
  );

  const removePayment = useMutation(
    trpc.payments.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(COPY.removed);
      },
      onError: async (error) => {
        toast.error(getErrorMessage(error));
        await invalidateAll();
      },
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    removePayment.mutate({ id: payment.id });
  };

  if (!payment.canEdit && !showDossierLink && !isAdmin) return null;

  return (
    <>
      <RemoveConfirmation />
      {/* Mounted while open only: each opening is a fresh form on the row's
          current version. */}
      {isEditOpen && (
        <UpdatePaymentDialog
          open
          onOpenChange={setIsEditOpen}
          initialValues={payment}
        />
      )}

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={removePayment.isPending}
                aria-label={COPY.actionsLabel}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            {payment.canEdit && (
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <PencilIcon />
                {COPY.edit}
              </DropdownMenuItem>
            )}
            {showDossierLink && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/patients/${payment.patientId}?tab=payments`)
                }
              >
                <FolderOpenIcon />
                {COPY.openDossier}
              </DropdownMenuItem>
            )}

            {isAdmin && (
              <>
                {(payment.canEdit || showDossierLink) && (
                  <DropdownMenuSeparator />
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void handleRemove()}
                >
                  <Trash2Icon />
                  {COPY.remove}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default PaymentActions;
