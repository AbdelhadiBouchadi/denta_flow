"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { useTRPC } from "@/trpc/client";
import { TASK_COPY as COPY } from "../../constants";
import TaskList from "../task-list";

/**
 * `/taches`: the two lists. Desktop, side by side; under 768 px, stacked with
 * the open tasks first — the DOM order is the mobile order.
 */
const TasksView = () => {
  const trpc = useTRPC();

  // No input: the server draws «today» itself. Same key as the prefetch.
  const { data } = useSuspenseQuery(trpc.tasks.getMany.queryOptions());

  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-4 px-4 pb-4 md:grid-cols-2 md:px-8">
      <TaskList
        id="tasks-open-title"
        title={COPY.openTitle}
        tasks={data.open}
        emptyMessage={COPY.openEmpty}
      />
      <TaskList
        id="tasks-done-title"
        title={COPY.doneTitle}
        tasks={data.done}
        emptyMessage={COPY.doneEmpty}
        note={COPY.doneWindowNote}
      />
    </div>
  );
};

export const TasksViewLoading = () => (
  <LoadingState title={COPY.loadingTitle} description={COPY.loadingDescription} />
);

export const TasksViewError = () => (
  <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
);

export default TasksView;
