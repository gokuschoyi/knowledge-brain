import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";

import { Card } from "../common/Card";

export function KnowledgeGraphView({ graph }: { graph: { nodes: Node[]; edges: Edge[] } }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodes = useMemo(() => {
    const documentNodes = graph.nodes.filter((node) => node.type === "document");
    const entityNodes = graph.nodes.filter((node) => node.type !== "document");

    const positionedDocuments = documentNodes.map((node, index) => ({
      ...node,
      type: "default",
      position: node.position ?? { x: 80, y: 80 + index * 140 },
      data: {
        originalType: node.type,
        label: node.data?.label ?? node.id,
        ...(node.data || {}),
      },
    }));

    const positionedEntities = entityNodes.map((node, index) => ({
      ...node,
      type: "default",
      position: node.position ?? {
        x: 420 + (index % 3) * 260,
        y: 80 + Math.floor(index / 3) * 140,
      },
      data: {
        originalType: node.type,
        label: node.data?.label ?? node.id,
        ...(node.data || {}),
      },
    }));

    return [...positionedDocuments, ...positionedEntities];
  }, [graph.nodes]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="h-[640px] overflow-hidden rounded-md">
          <ReactFlow
            nodes={nodes}
            edges={graph.edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-white">Selected node</h3>
          <pre className="whitespace-pre-wrap text-xs text-slate-300">{selectedNode ? JSON.stringify(selectedNode.data, null, 2) : "Click a node to inspect it."}</pre>
        </Card>
      </div>
    </div>
  );
}
