import { Card } from '../common/Card';

export function RepairResultPanel({ task }: { task: any | null }) {
  if (!task?.result || !Object.keys(task.result).length) return null;
  return (
    <Card>
      <h3 className='mb-3 text-sm font-semibold text-white'>
        Latest repair result
      </h3>
      <pre className='whitespace-pre-wrap text-xs text-slate-300'>
        {JSON.stringify(task.result, null, 2)}
      </pre>
    </Card>
  );
}
