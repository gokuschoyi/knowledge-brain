import { useQuery } from "@tanstack/react-query";

import { getGraph } from "../api/graph";
import { GraphLegend } from "../components/graph/GraphLegend";
import { KnowledgeGraphView } from "../components/graph/KnowledgeGraphView";
import { LoadingState } from "../components/common/LoadingState";

export function KnowledgeGraphPage() {
  const { data, isLoading } = useQuery({ queryKey: ["graph"], queryFn: getGraph });

  if (isLoading || !data) return <LoadingState label="Loading graph..." />;

  return (
    <div className="space-y-6">
      <GraphLegend />
      <KnowledgeGraphView graph={data} />
    </div>
  );
}

