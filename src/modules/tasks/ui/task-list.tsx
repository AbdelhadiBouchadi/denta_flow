import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TaskListItem } from "../types";
import TaskRow from "./task-row";

interface TaskListProps {
  id: string;
  title: string;
  tasks: TaskListItem[];
  emptyMessage: string;
  /** A muted line under the list — the done list's 30-day cut. */
  note?: string;
}

/** One of the two lists: a card, its count, its rows or its empty line. */
const TaskList = ({ id, title, tasks, emptyMessage, note }: TaskListProps) => (
  <Card role="region" aria-labelledby={id} className="min-w-0 gap-0 py-0">
    <CardHeader className="flex flex-row items-center gap-2 border-b py-4">
      <CardTitle id={id} className="font-heading text-h4">
        {title}
      </CardTitle>
      <Badge variant="secondary" className="tabular-nums">
        {tasks.length}
      </Badge>
    </CardHeader>

    <CardContent className="px-0">
      {tasks.length === 0 ? (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </CardContent>

    {note && (
      <CardFooter className="text-muted-foreground border-t py-3 text-xs">
        {note}
      </CardFooter>
    )}
  </Card>
);

export default TaskList;
