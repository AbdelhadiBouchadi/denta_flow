"use client";

import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import type { FallbackProps } from "react-error-boundary";

import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc/client";
import { TAB_LABELS, TAB_VALUES, WHATSAPP_COPY as COPY } from "../../constants";
import { useWhatsappFilters } from "../../hooks/use-whatsapp-filters";
import { journalQueryInput } from "../../query-inputs";
import { WhatsappTab } from "../../types";
import { JournalTab } from "../journal-tab";
import { RulesTab } from "../rules-tab";
import { ServiceTab } from "../service-tab";
import { TemplatesTab } from "../templates-tab";

/**
 * Paramètres › WhatsApp (admin). Four tabs, the active one in the URL as
 * `waTab`. Every query of every tab is prefetched by /parametres with the
 * same inputs, so switching tabs never shows a spinner.
 */
const WhatsappSettingsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useWhatsappFilters();

  // Read here so a failure of any of them reaches this view's boundary.
  useSuspenseQuery(trpc.whatsapp.getServiceStatus.queryOptions());
  useSuspenseQuery(trpc.whatsapp.getSettings.queryOptions());
  useSuspenseQuery(trpc.whatsapp.getTemplates.queryOptions());
  useSuspenseQuery(trpc.whatsapp.listRules.queryOptions());
  useSuspenseQuery(trpc.whatsapp.getJournal.queryOptions(journalQueryInput(filters)));

  return (
    <Tabs
      value={filters.waTab}
      onValueChange={(value) => void setFilters({ waTab: value as WhatsappTab })}
      className="min-w-0 gap-4"
    >
      <div className="[scrollbar-width:none] min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <TabsList
          variant="line"
          className="w-max min-w-full justify-start rounded-none border-b bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {TAB_VALUES.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-muted-foreground hover:text-foreground data-active:text-primary data-active:border-b-primary -mb-px h-11 flex-none rounded-none border-b-2 border-x-transparent border-t-transparent border-b-transparent px-3 font-medium after:hidden"
            >
              {TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value={WhatsappTab.Service}>
        <ServiceTab />
      </TabsContent>
      <TabsContent value={WhatsappTab.Templates}>
        <TemplatesTab />
      </TabsContent>
      <TabsContent value={WhatsappTab.Rules}>
        <RulesTab />
      </TabsContent>
      <TabsContent value={WhatsappTab.Journal}>
        <JournalTab />
      </TabsContent>
    </Tabs>
  );
};

export const WhatsappSettingsViewLoading = () => (
  <LoadingState
    title={COPY.settingsLoadingTitle}
    description={COPY.loadingDescription}
  />
);

export const WhatsappSettingsViewError = ({ resetErrorBoundary }: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <ErrorState
        title={COPY.settingsErrorTitle}
        description={COPY.settingsErrorDescription}
      />
      <Button
        variant="outline"
        onClick={() => {
          reset();
          resetErrorBoundary();
        }}
      >
        <RotateCcwIcon />
        {COPY.retryLoad}
      </Button>
    </div>
  );
};

export default WhatsappSettingsView;
