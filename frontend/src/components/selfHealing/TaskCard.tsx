import { Button } from "../common/Button";
import { Card } from "../common/Card";

export function TaskCard({ task, onRun, onIgnore }: { task: any; onRun: (id: number) => Promise<void>; onIgnore: (id: number) => Promise<void> }) {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{task.description}</p>
        </div>
        <div className="text-xs uppercase tracking-wide text-cyan-300">{task.status}</div>
      </div>
      <div className="mb-4 text-xs text-slate-500">
        {task.task_type} · priority {task.priority}
      </div>
      {task.result && Object.keys(task.result).length ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(task.result, null, 2)}</pre>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={() => onRun(task.id)}>Run</Button>
        <Button className="bg-slate-700 text-white hover:bg-slate-600" onClick={() => onIgnore(task.id)}>
          Ignore
        </Button>
      </div>
    </Card>
  );
}

