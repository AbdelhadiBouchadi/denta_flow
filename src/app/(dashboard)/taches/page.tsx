import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import TasksListHeader from "@/modules/tasks/ui/list-header";
import TasksView, {
  TasksViewError,
  TasksViewLoading,
} from "@/modules/tasks/ui/views/tasks-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Liste des tâches",
};

/**
 * A routing shell: read the session, prefetch, render the slice's view
 * (AGENTS.md §1). No searchParams — the list has no URL state.
 */
const TasksPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  // `void`, never `await` (04-hydration.md §4 rule 1).
  void queryClient.prefetchQuery(trpc.tasks.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksListHeader />
      <Suspense fallback={<TasksViewLoading />}>
        <ErrorBoundary fallback={<TasksViewError />}>
          <TasksView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default TasksPage;
