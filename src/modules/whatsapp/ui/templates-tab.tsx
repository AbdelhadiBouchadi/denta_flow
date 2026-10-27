"use client";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  EllipsisIcon,
  FlaskConicalIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDateTime } from "@/lib/format";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_LABELS,
  EVENT_TONES,
  EVENT_VALUES,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import { TemplateApproval, type WhatsappTemplateItem } from "../types";
import { ApprovalBadge } from "./approval-badge";
import { MessagePreview } from "./message-preview";
import TemplateDialog from "./template-dialog";

const TemplateCard = ({
  template,
  preview,
  canSubmit,
  onEdit,
}: {
  template: WhatsappTemplateItem;
  preview: Parameters<typeof MessagePreview>[0]["values"];
  canSubmit: boolean;
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
  const submit = useMutation(
    trpc.whatsapp.submitTemplate.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.templateSubmitted);
      },
      onError: async (error) => {
        await invalidate();
        toast.error(error.message);
      },
    }),
  );

  const status = template.approvalStatus;

  return (
    <Card className="gap-3 px-4 py-4">
      <RemoveConfirmation />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-foreground font-medium">{template.name}</h4>
          <StatusBadge label={EVENT_LABELS[template.kind]} tone={EVENT_TONES[template.kind]} />
          {canSubmit && <ApprovalBadge status={status} reason={template.rejectionReason} />}
          {!template.isActive && <StatusBadge label={COPY.inactive} tone="neutral" />}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={COPY.colActions} />}
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

      <MessagePreview segments={template.segments} values={preview} />

      {canSubmit && (
        <div className="flex flex-col gap-2 text-sm">
          {status === TemplateApproval.Rejected && template.rejectionReason && (
            <p className="text-danger-strong">{template.rejectionReason}</p>
          )}
          {status === TemplateApproval.Pending && (
            <p className="text-muted-foreground">{COPY.pendingHelp}</p>
          )}
          {status !== TemplateApproval.Approved && template.hasApprovedVersion && (
            <p className="text-muted-foreground">{COPY.previousVersionActive}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {status === TemplateApproval.Approved && template.approvedAt
                ? COPY.approvedOn(formatDateTime(template.approvedAt))
                : status === TemplateApproval.Pending && template.submittedAt
                  ? COPY.submittedOn(formatDateTime(template.submittedAt))
                  : null}
            </span>
            {status === TemplateApproval.Draft && (
              <Button
                size="sm"
                variant="outline"
                disabled={submit.isPending}
                onClick={() => submit.mutate({ id: template.id })}
              >
                {submit.isPending ? <Spinner /> : <SendIcon />}
                {COPY.submitForApproval}
              </Button>
            )}
            {status === TemplateApproval.Rejected && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <PencilIcon />
                {COPY.fixAndResubmit}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * «Modèles de messages» (prompts/33b, decision 6): each template with its
 * patient-side preview and, with a real sender, its WhatsApp approval —
 * submitted from here, refreshed with «Actualiser» and once when the tab
 * opens (the tab's panel mounts on open). In test mode, and without a
 * connection, the texts are used as they are and no approval is shown.
 */
export const TemplatesTab = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const { data } = useSuspenseQuery(trpc.whatsapp.getTemplates.queryOptions());
  const { data: status } = useSuspenseQuery(trpc.whatsapp.getServiceStatus.queryOptions());
  const [dialog, setDialog] = useState<{
    open: boolean;
    template?: WhatsappTemplateItem;
  }>({ open: false });

  const canSubmit = status.templateSubmission === "available";
  const drafts = data.items.filter(
    (template) => template.isActive && template.approvalStatus === TemplateApproval.Draft,
  ).length;
  const pending = data.items.some(
    (template) => template.approvalStatus === TemplateApproval.Pending,
  );

  const refresh = useMutation(
    trpc.whatsapp.refreshTemplateStatuses.mutationOptions({
      onSuccess: async () => {
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const submitAll = useMutation(
    trpc.whatsapp.submitAllDrafts.mutationOptions({
      onSuccess: async ({ submitted, failed }) => {
        await invalidate();
        if (failed > 0) toast.error(COPY.submitAllDone(submitted, failed));
        else toast.success(COPY.submitAllDone(submitted, failed));
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  // Once per opening of the tab, if a verdict is awaited: an action, not a
  // data read — the list itself stays the prefetched query.
  const refreshedOnOpen = useRef(false);
  useEffect(() => {
    if (refreshedOnOpen.current || !canSubmit || !pending) return;
    refreshedOnOpen.current = true;
    refresh.mutate();
  }, [canSubmit, pending, refresh]);

  return (
    <div className="flex flex-col gap-4">
      <TemplateDialog
        open={dialog.open}
        initialValues={dialog.template}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />

      <Alert>
        {status.templateSubmission === "sandbox" ? <FlaskConicalIcon /> : <InfoIcon />}
        <AlertDescription>
          {status.templateSubmission === "available"
            ? COPY.templatesIntro
            : status.templateSubmission === "sandbox"
              ? COPY.templatesTestMode
              : COPY.templatesNotConnected}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canSubmit && pending && (
          <Button variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {refresh.isPending ? <Spinner /> : <RefreshCwIcon />}
            {COPY.refreshStatuses}
          </Button>
        )}
        {canSubmit && drafts > 0 && (
          <Button
            variant="outline"
            className="h-auto min-h-9 whitespace-normal"
            disabled={submitAll.isPending}
            onClick={() => submitAll.mutate()}
          >
            {submitAll.isPending ? <Spinner /> : <SendIcon />}
            {COPY.submitAllDrafts}
          </Button>
        )}
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
              <div className="grid gap-3 xl:grid-cols-2">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    preview={data.preview}
                    canSubmit={canSubmit}
                    onEdit={() => setDialog({ open: true, template })}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};
