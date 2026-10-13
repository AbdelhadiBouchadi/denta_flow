"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { canWriteMedicalDocuments } from "@/modules/documents/rules";
import { useTRPC } from "@/trpc/client";
import { CERTIFICATE_COPY as COPY } from "../../constants";
import type { CertificateTemplateItem } from "../../types";
import UpdateTemplateDialog from "../update-template-dialog";

/**
 * The «Modèles de certificats» section of /parametres: the three templates,
 * each with its text as plain, pre-wrapped text. `certificateTemplates.getMany`
 * is prefetched by the page.
 */
const CertificateTemplatesView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.certificateTemplates.getMany.queryOptions(),
  );
  const { data: session } = authClient.useSession();
  const canWrite = canWriteMedicalDocuments(session?.user.role);

  if (data.length === 0) {
    return (
      <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
    );
  }

  return (
    <ul className="flex min-w-0 flex-col gap-3">
      {data.map((template) => (
        <li key={template.id} className="min-w-0">
          <TemplateCard template={template} canWrite={canWrite} />
        </li>
      ))}
    </ul>
  );
};

const TemplateCard = ({
  template,
  canWrite,
}: {
  template: CertificateTemplateItem;
  canWrite: boolean;
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-foreground font-medium wrap-break-word">
            {template.title}
          </h3>
          <StatusBadge
            label={template.isActive ? COPY.active : COPY.inactive}
            tone={template.isActive ? "success" : "neutral"}
          />
        </div>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            <PencilIcon />
            {COPY.edit}
          </Button>
        )}
      </header>
      <p className="bg-muted text-foreground-secondary rounded-md p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
        {template.body}
      </p>
      {isEditOpen && (
        <UpdateTemplateDialog
          template={template}
          open
          onOpenChange={setIsEditOpen}
        />
      )}
    </article>
  );
};

export const CertificateTemplatesViewLoading = () => (
  <LoadingState title={COPY.loadingTitle} description={COPY.loadingDescription} />
);

export const CertificateTemplatesViewError = () => (
  <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
);

export default CertificateTemplatesView;
