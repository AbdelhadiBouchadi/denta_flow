"use client";

import { useMutation } from "@tanstack/react-query";
import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShieldIcon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
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
import { useTRPC } from "@/trpc/client";
import { STAFF_COPY } from "../constants";
import { useInvalidateStaff } from "../hooks/use-invalidate-staff";
import type { StaffCreated, StaffListItem } from "../types";
import TemporaryPasswordDialog from "./temporary-password-dialog";
import UpdateRoleDialog from "./update-role-dialog";
import UpdateStaffDialog from "./update-staff-dialog";

interface StaffActionsProps {
  staff: StaffListItem;
}

/**
 * A row's menu, rendered for admins only — and that is a courtesy: every
 * procedure behind it is an `adminProcedure` (AGENTS.md §2).
 *
 * On the admin's own row, «Changer le rôle» and «Désactiver» are disabled:
 * both would be refused by the server's self-guards anyway.
 */
const StaffActions = ({ staff }: StaffActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateStaff();
  const { data: session } = authClient.useSession();
  const isSelf = session?.user.id === staff.id;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [resetResult, setResetResult] = useState<StaffCreated | null>(null);

  const [DeactivateConfirmation, confirmDeactivate] = useConfirm(
    STAFF_COPY.deactivateConfirmTitle,
    STAFF_COPY.deactivateConfirmDescription,
    "destructive",
  );
  const [ResetConfirmation, confirmReset] = useConfirm(
    STAFF_COPY.resetConfirmTitle,
    STAFF_COPY.resetConfirmDescription,
  );

  const deactivate = useMutation(
    trpc.staff.deactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(STAFF_COPY.deactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const reactivate = useMutation(
    trpc.staff.reactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(STAFF_COPY.reactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const resetPassword = useMutation(
    trpc.staff.resetPassword.mutationOptions({
      onSuccess: async (result) => {
        await invalidateAll();
        toast.success(STAFF_COPY.passwordReset);
        setResetResult(result);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending =
    deactivate.isPending || reactivate.isPending || resetPassword.isPending;

  const handleDeactivate = async () => {
    if (!(await confirmDeactivate())) return;
    deactivate.mutate({ id: staff.id });
  };

  const handleReset = async () => {
    if (!(await confirmReset())) return;
    resetPassword.mutate({ id: staff.id });
  };

  return (
    <>
      <DeactivateConfirmation />
      <ResetConfirmation />
      <UpdateStaffDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={staff}
      />
      <UpdateRoleDialog
        open={isRoleOpen}
        onOpenChange={setIsRoleOpen}
        staff={staff}
      />
      <TemporaryPasswordDialog
        result={resetResult}
        onClose={() => setResetResult(null)}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={isPending}
                aria-label={`${STAFF_COPY.actionsLabel} ${staff.name}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {STAFF_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setIsRoleOpen(true)}
            >
              <ShieldIcon />
              {STAFF_COPY.changeRole}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReset}>
              <KeyRoundIcon />
              {STAFF_COPY.resetPassword}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {staff.isActive ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={isSelf}
                onClick={handleDeactivate}
              >
                <UserXIcon />
                {STAFF_COPY.deactivate}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => reactivate.mutate({ id: staff.id })}
              >
                <UserCheckIcon />
                {STAFF_COPY.reactivate}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default StaffActions;
