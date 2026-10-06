"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { useTRPC } from "@/trpc/client";
import { TAG_COPY } from "../../constants";
import { actionsColumn, columns } from "../columns";
import NewTagButton from "../new-tag-button";

/**
 * The «Tags» section of /parametres. `tags.getMany` is prefetched by the page;
 * this reads it from the hydrated cache. No pagination and no filters: a
 * clinic has a handful of tags (prompts/13-tags-assurances.md).
 */
const TagsView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.tags.getMany.queryOptions());

  // Cosmetic only — every write behind the actions column is adminProcedure.
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;
  const visibleColumns = useMemo(
    () => (isAdmin ? [...columns, actionsColumn] : columns),
    [isAdmin],
  );

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <EmptyState
          title={TAG_COPY.emptyTitle}
          description={TAG_COPY.emptyDescription}
        />
        {isAdmin && <NewTagButton />}
      </div>
    );
  }

  return <DataTable columns={visibleColumns} data={data.items} />;
};

export const TagsViewLoading = () => (
  <LoadingState
    title={TAG_COPY.loadingTitle}
    description={TAG_COPY.loadingDescription}
  />
);

export const TagsViewError = () => (
  <ErrorState
    title={TAG_COPY.errorTitle}
    description={TAG_COPY.errorDescription}
  />
);

export default TagsView;
