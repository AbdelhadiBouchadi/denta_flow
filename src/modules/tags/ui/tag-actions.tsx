"use client";

import { useMutation } from "@tanstack/react-query";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { TAG_COPY, tagRemoveConfirmDescription } from "../constants";
import { useInvalidateTags } from "../hooks/use-invalidate-tags";
import type { TagListItem } from "../types";
import UpdateTagDialog from "./update-tag-dialog";

interface TagActionsProps {
  tag: TagListItem;
}

/**
 * A row's menu, rendered for admins only — a courtesy: `tags.update` and
 * `tags.remove` are `adminProcedure`.
 *
 * Remove is a hard delete, so it is confirmed, and the confirmation names the
 * cascade with the real patient count.
 */
const TagActions = ({ tag }: TagActionsProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateTags();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    TAG_COPY.removeConfirmTitle,
    tagRemoveConfirmDescription(tag.label, tag.patientCount),
    "destructive",
  );

  const remove = useMutation(
    trpc.tags.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(TAG_COPY.removed);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const handleRemove = async () => {
    if (!(await confirmRemove())) return;
    remove.mutate({ id: tag.id });
  };

  return (
    <>
      <RemoveConfirmation />
      <UpdateTagDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={tag}
      />

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={remove.isPending}
                aria-label={`${TAG_COPY.actionsLabel} ${tag.label}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <PencilIcon />
              {TAG_COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleRemove}>
              <Trash2Icon />
              {TAG_COPY.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TagActions;
