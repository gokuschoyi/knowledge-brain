import { Card } from "../common/Card";

export function KnowledgeGapPanel({ gaps }: { gaps: string[] }) {
  if (!gaps.length) return null;
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-white">Knowledge gaps</h3>
      <ul className="space-y-2 text-sm text-slate-300">
        {gaps.map((gap) => (
          <li key={gap}>- {gap}</li>
        ))}
      </ul>
    </Card>
  );
}

