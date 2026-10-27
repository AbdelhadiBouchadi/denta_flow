"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { LightbulbIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { WHATSAPP_COPY as COPY } from "../constants";
import type { WhatsappRuleItem } from "../types";
import RuleDialog from "./rule-dialog";
import { getColumns } from "./rules-columns";

/** «Automatisations» — «Règles d’envoi automatique». */
export const RulesTab = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.whatsapp.listRules.queryOptions());
  const [dialog, setDialog] = useState<{ open: boolean; rule?: WhatsappRuleItem }>({
    open: false,
  });
  // Stable, or the table would rebuild its columns on every render.
  const columns = useMemo(
    () => getColumns((rule) => setDialog({ open: true, rule })),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <RuleDialog
        open={dialog.open}
        initialValues={dialog.rule}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-h3 text-foreground">{COPY.rulesTitle}</h3>
        <Button size="lg" onClick={() => setDialog({ open: true })}>
          <PlusIcon />
          {COPY.addRule}
        </Button>
      </div>

      <Alert>
        <LightbulbIcon />
        <AlertDescription>{COPY.rulesAdvice}</AlertDescription>
      </Alert>

      {data.items.length === 0 ? (
        <div className="py-10">
          <EmptyState title={COPY.rulesEmpty} description={COPY.rulesEmptyDescription} />
        </div>
      ) : (
        <DataTable columns={columns} data={data.items} />
      )}
    </div>
  );
};
