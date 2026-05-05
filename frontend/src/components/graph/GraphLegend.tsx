import { Card } from "../common/Card";

export function GraphLegend() {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-white">Legend</h3>
      <div className="space-y-2 text-sm text-slate-300">
        <div>Document nodes represent ingested sources.</div>
        <div>Entity nodes capture extracted concepts.</div>
        <div>Edges represent grounded relationships.</div>
      </div>
    </Card>
  );
}

