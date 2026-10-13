"use client";

import { authClient } from "@/lib/auth-client";
import { canWriteMedicalDocuments } from "@/modules/documents/rules";
import { CERTIFICATE_COPY as COPY } from "../constants";
import { VariableLegend } from "./variable-chips";

/** The «Modèles de certificats» heading and the variables, spelled out. */
const CertificateTemplatesListHeader = () => {
  const { data: session, isPending } = authClient.useSession();
  const canWrite = canWriteMedicalDocuments(session?.user.role);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-heading text-h3 text-foreground">
          {COPY.sectionTitle}
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {COPY.sectionDescription}
        </p>
      </div>
      {!canWrite && !isPending && (
        <p className="text-muted-foreground text-sm">{COPY.readOnly}</p>
      )}
      <section className="bg-muted flex min-w-0 flex-col gap-2 rounded-lg p-4">
        <h3 className="text-label text-muted-foreground uppercase">
          {COPY.variablesTitle}
        </h3>
        <VariableLegend />
      </section>
    </div>
  );
};

export default CertificateTemplatesListHeader;
