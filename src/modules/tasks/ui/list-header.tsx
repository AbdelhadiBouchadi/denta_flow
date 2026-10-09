import { TASK_COPY as COPY } from "../constants";
import TaskAddBar from "./task-add-bar";

/**
 * The page title and the add bar. Rendered by the page outside the list's
 * `<Suspense>`: the bar needs no data, so it is usable while the lists load.
 * A Server Component — the only client part is the bar itself.
 */
const TasksListHeader = () => (
  <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
    <h1 className="font-heading text-h1 text-foreground">{COPY.pageTitle}</h1>
    <TaskAddBar />
  </div>
);

export default TasksListHeader;
