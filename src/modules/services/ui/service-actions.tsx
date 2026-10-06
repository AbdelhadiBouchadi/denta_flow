"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CircleCheckIcon,
  CircleOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
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
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { SERVICE_COPY } from "../constants";
import { useInvalidateServices } from "../hooks/use-invalidate-services";
import type { ServiceListItem } from "../types";
import UpdateServiceDialog from "./update-service-dialog";

interface ServiceActionsProps {
  service: ServiceListItem;
}

/**
 * A row's menu, rendered for admins only — a courtesy: every procedure behind
 * it is an `adminProcedure`.
 *
 * Deactivate and reactivate are a plain toggle with a toast, no confirmation:
 * nothing is lost, and the other one undoes it. There is no delete.
 */
const ServiceActions = ({ service }: ServiceActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateServices();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const deactivate = useMutation(
    trpc.services.deactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(SERVICE_COPY.deactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const reactivate = useMutation(
    trpc.services.reactivate.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(SERVICE_COPY.reactivated);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const isPending = deactivate.isPending || reactivate.isPending;

  return (
    <>
      <UpdateServiceDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={service}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={isPending}
                aria-label={`${SERVICE_COPY.actionsLabel} ${service.label}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {SERVICE_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {service.isActive ? (
              <DropdownMenuItem
                onClick={() => deactivate.mutate({ id: service.id })}
              >
                <CircleOffIcon />
                {SERVICE_COPY.deactivate}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => reactivate.mutate({ id: service.id })}
              >
                <CircleCheckIcon />
                {SERVICE_COPY.reactivate}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default ServiceActions;
