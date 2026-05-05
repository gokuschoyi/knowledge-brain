import { IngestionJob } from "../../api/documents";
import { Card } from "../common/Card";

export function IngestionProgress({ job }: { job: IngestionJob | null }) {
  if (!job) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Ingestion progress</h3>
          <p className="text-xs text-slate-400">{job.current_step || "Queued"}</p>
        </div>
        <div className="text-sm text-cyan-300">{job.progress}%</div>
      </div>
      <div className="mb-4 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${job.progress}%` }} />
      </div>
      <div className="space-y-2">
        {job.log.map((entry, index) => (
          <div key={`${entry.step}-${index}`} className="text-sm text-slate-300">
            <span className="text-slate-500">{entry.step}</span> {entry.message}
          </div>
        ))}
      </div>
    </Card>
  );
}

