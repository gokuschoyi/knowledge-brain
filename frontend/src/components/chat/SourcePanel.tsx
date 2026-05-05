import { Card } from "../common/Card";

export function SourcePanel({ sources }: { sources: { document_title: string; chunk_id: number; snippet: string }[] }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-white">Sources</h3>
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.chunk_id} className="rounded-md border border-slate-800 p-3">
            <div className="mb-1 text-sm font-medium text-white">{source.document_title}</div>
            <div className="text-xs text-slate-400">Chunk {source.chunk_id}</div>
            <p className="mt-2 text-sm text-slate-300">{source.snippet}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

