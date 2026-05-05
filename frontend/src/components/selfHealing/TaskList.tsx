import { TaskCard } from "./TaskCard";

export function TaskList({ tasks, onRun, onIgnore }: { tasks: any[]; onRun: (id: number) => Promise<void>; onIgnore: (id: number) => Promise<void> }) {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onRun={onRun} onIgnore={onIgnore} />
      ))}
    </div>
  );
}

