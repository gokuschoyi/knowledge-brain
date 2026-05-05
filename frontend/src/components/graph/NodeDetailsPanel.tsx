import { Card } from "../common/Card";

export function NodeDetailsPanel({ node }: { node: any | null }) {
  if (!node) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-white">Node details</h3>
        <p className="mt-2 text-sm text-slate-400">Select a node in the graph to inspect its metadata.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-white">{node.label}</h3>
      <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-300">{JSON.stringify(node.data, null, 2)}</pre>
    </Card>
  );
}

