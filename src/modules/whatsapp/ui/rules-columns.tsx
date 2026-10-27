"use client";

import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { DataTableFeatures } from "@/components/shared/data-table";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/hooks/use-confirm";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_LABELS,
  EVENT_TONES,
  formatTiming,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import type { WhatsappRuleItem } from "../types";

const RuleStatusCell = ({ rule }: { rule: WhatsappRuleItem }) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const toggle = useMutation(
    trpc.whatsapp.toggleRule.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.ruleSaved);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={rule.enabled}
        aria-label={rule.enabled ? COPY.ruleEnabled : COPY.ruleDisabled}
        disabled={toggle.isPending}
        onCheckedChange={(enabled) => toggle.mutate({ id: rule.id, enabled })}
      />
      <StatusBadge
        label={rule.enabled ? COPY.ruleEnabled : COPY.ruleDisabled}
        tone={rule.enabled ? "success" : "neutral"}
      />
    </div>
  );
};

const RuleActionsCell = ({
  rule,
  onEdit,
}: {
  rule: WhatsappRuleItem;
  onEdit: (rule: WhatsappRuleItem) => void;
}) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.deleteRuleTitle,
    COPY.deleteRuleDescription,
    "destructive",
  );
  const remove = useMutation(
    trpc.whatsapp.removeRule.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.ruleDeleted);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <div className="flex justify-end">
      <RemoveConfirmation />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={COPY.colActions} />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onEdit(rule)}>
            <PencilIcon />
            {COPY.edit}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={remove.isPending}
            onClick={async () => {
              if (await confirmRemove()) remove.mutate({ id: rule.id });
            }}
          >
            <Trash2Icon />
            {COPY.deleteTemplate}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/** Modèle associé · Événement déclencheur · Programmation · Statut · actions. */
export const getColumns = (
  onEdit: (rule: WhatsappRuleItem) => void,
): ColumnDef<DataTableFeatures, WhatsappRuleItem>[] => [
  {
    id: "template",
    header: COPY.colTemplate,
    cell: ({ row }) => (
      <span className="text-foreground font-medium">{row.original.template.name}</span>
    ),
  },
  {
    id: "event",
    header: COPY.colTrigger,
    cell: ({ row }) => (
      <StatusBadge
        label={EVENT_LABELS[row.original.event]}
        tone={EVENT_TONES[row.original.event]}
      />
    ),
  },
  {
    id: "timing",
    header: COPY.colTiming,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatTiming(row.original.event, row.original.offsetMinutes)}
      </span>
    ),
  },
  {
    id: "status",
    header: COPY.colRuleStatus,
    cell: ({ row }) => <RuleStatusCell rule={row.original} />,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{COPY.colActions}</span>,
    cell: ({ row }) => <RuleActionsCell rule={row.original} onEdit={onEdit} />,
  },
];
