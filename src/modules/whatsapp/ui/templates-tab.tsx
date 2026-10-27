"use client";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  CopyIcon,
  EllipsisIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import EmptyState from "@/components/shared/empty-state";
import StatusBadge from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { useTRPC } from "@/trpc/client";
import {
  APPROVED_BODIES,
  EVENT_LABELS,
  EVENT_TONES,
  EVENT_VALUES,
  MESSAGE_VARIABLES,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import { renderManualText, SAMPLE_PARAMS } from "../message";
import type { WhatsappTemplateItem } from "../types";
import TemplateDialog from "./template-dialog";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(COPY.copied);
  } catch {
    // Clipboard refused (insecure context): the text stays selectable.
  }
};

const TemplateCard = ({
  template,
  onEdit,
}: {
  template: WhatsappTemplateItem;
  onEdit: () => void;
}) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    COPY.deleteTemplateTitle,
    COPY.deleteTemplateDescription,
    "destructive",
  );
  const remove = useMutation(
    trpc.whatsapp.removeTemplate.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.templateDeleted);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const approved = APPROVED_BODIES[template.kind];

  return (
    <Card className="gap-3 px-4 py-4">
      <RemoveConfirmation />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-foreground font-medium">{template.name}</h4>
          <StatusBadge label={EVENT_LABELS[template.kind]} tone={EVENT_TONES[template.kind]} />
          <StatusBadge
            label={template.contentSid ? COPY.configured : COPY.notConfigured}
            tone={template.contentSid ? "success" : "warning"}
          />
          {!template.isActive && <StatusBadge label={COPY.inactive} tone="neutral" />}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={COPY.colActions} />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon />
              {COPY.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={template.isUsed || remove.isPending}
              onClick={async () => {
                if (await confirmRemove()) remove.mutate({ id: template.id });
              }}
            >
              <Trash2Icon />
              {COPY.deleteTemplate}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">{COPY.approvedBody}</span>
            <Button variant="ghost" size="xs" onClick={() => void copyText(approved)}>
              <CopyIcon />
              {COPY.copyText}
            </Button>
          </div>
          <p className="bg-muted rounded-lg px-3 py-2 text-sm break-words">{approved}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{COPY.templateManualText}</span>
          <p className="rounded-lg border px-3 py-2 text-sm break-words">
            {renderManualText(template.manualText, SAMPLE_PARAMS)}
          </p>
        </div>
      </div>
    </Card>
  );
};

/** «Modèles de messages»: the templates grouped by event. */
export const TemplatesTab = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.whatsapp.listTemplates.queryOptions());
  const [dialog, setDialog] = useState<{
    open: boolean;
    template?: WhatsappTemplateItem;
  }>({ open: false });

  return (
    <div className="flex flex-col gap-4">
      <TemplateDialog
        open={dialog.open}
        initialValues={dialog.template}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Alert className="max-w-3xl flex-1">
          <InfoIcon />
          <AlertDescription>
            {COPY.templatesNote}
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {MESSAGE_VARIABLES.map((variable) => (
                <span key={variable.position} className="text-xs">
                  <code className="font-mono">{`{{${variable.position}}}`}</code>{" "}
                  {variable.label}
                </span>
              ))}
            </span>
          </AlertDescription>
        </Alert>
        <Button size="lg" onClick={() => setDialog({ open: true })}>
          <PlusIcon />
          {COPY.newTemplate}
        </Button>
      </div>

      {data.items.length === 0 ? (
        <div className="py-10">
          <EmptyState title={COPY.templatesEmpty} description={COPY.templatesEmptyDescription} />
        </div>
      ) : (
        EVENT_VALUES.map((kind) => {
          const templates = data.items.filter((template) => template.kind === kind);
          if (templates.length === 0) return null;
          return (
            <section key={kind} className="flex flex-col gap-2">
              <h3 className="text-h4 text-foreground font-medium">{EVENT_LABELS[kind]}</h3>
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => setDialog({ open: true, template })}
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
};
