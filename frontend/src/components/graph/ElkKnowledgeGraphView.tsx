import { useEffect, useMemo, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
} from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Grid, Heading, Spinner, Stack, Text } from '@chakra-ui/react';

import type { GraphResponse } from '../../api/types';
import { Card } from '../common/Card';
import { NodeDetails } from './NodeDetails';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;
const elk = new ELK();

const NODE_THEME = {
  document: {
    border: '#0891b2',
    background:
      'linear-gradient(180deg, rgba(8, 145, 178, 0.24) 0%, rgba(12, 74, 110, 0.34) 100%)',
    color: '#ecfeff',
    boxShadow: '0 8px 24px rgba(8, 145, 178, 0.14)',
  },
  entity: {
    border: '#7c3aed',
    background:
      'linear-gradient(180deg, rgba(109, 40, 217, 0.22) 0%, rgba(49, 46, 129, 0.3) 100%)',
    color: '#f5f3ff',
    boxShadow: '0 8px 24px rgba(76, 29, 149, 0.16)',
  },
} as const;

function getBaseNodes(graph: GraphResponse): Node[] {
  return graph.nodes.map((node) => {
    const theme =
      node.type === 'document' ? NODE_THEME.document : NODE_THEME.entity;

    return {
      ...node,
      type: 'default',
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x: 0, y: 0 },
      style: {
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        background: theme.background,
        color: theme.color,
        padding: '10px 12px',
        fontSize: '12px',
        boxShadow: theme.boxShadow,
      },
      data: {
        originalType: node.type,
        label: node.label ?? node.id,
        ...(node.data || {}),
      },
    };
  });
}

function getBaseEdges(graph: GraphResponse): Edge[] {
  return graph.edges.map((edge) => ({
    ...edge,
    type: 'smoothstep' as const,
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: '#64748b',
    },
    style: {
      stroke: '#64748b',
      strokeWidth: 1.25,
    },
    labelStyle: {
      fill: '#64748b',
      fontSize: 11,
    },
  }));
}

async function getElkLayout(graph: GraphResponse) {
  const baseNodes = getBaseNodes(graph);
  const baseEdges = getBaseEdges(graph);

  const elkGraph = await elk.layout({
    id: 'knowledge-graph',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
      'elk.spacing.nodeNode': '60',
      'elk.spacing.edgeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '96',
    },
    children: graph.nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });

  const positions = new Map(
    (elkGraph.children || []).map((node) => [
      node.id,
      {
        x: node.x ?? 0,
        y: node.y ?? 0,
      },
    ]),
  );

  return {
    nodes: baseNodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: baseEdges,
  };
}

export function ElkKnowledgeGraphView({ graph }: { graph: GraphResponse }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);
  const [isLayouting, setIsLayouting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function layoutGraph() {
      setIsLayouting(true);
      const layoutedGraph = await getElkLayout(graph);

      if (cancelled) return;

      setLayoutedNodes(layoutedGraph.nodes);
      setLayoutedEdges(layoutedGraph.edges);
      setIsLayouting(false);
    }

    void layoutGraph();

    return () => {
      cancelled = true;
    };
  }, [graph]);

  const connectedGraph = useMemo(() => {
    if (!selectedNodeId) {
      return {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
      };
    }

    const adjacency = new Map<
      string,
      Array<{ nodeId: string; edgeId: string }>
    >();
    layoutedEdges.forEach((edge) => {
      const sourceNeighbors = adjacency.get(edge.source) ?? [];
      sourceNeighbors.push({ nodeId: edge.target, edgeId: edge.id });
      adjacency.set(edge.source, sourceNeighbors);
    });

    const nodeIds = new Set<string>([selectedNodeId]);
    const edgeIds = new Set<string>();
    const queue = [selectedNodeId];

    while (queue.length > 0) {
      const currentNodeId = queue.shift();
      if (!currentNodeId) continue;

      const neighbors = adjacency.get(currentNodeId) ?? [];
      neighbors.forEach(({ nodeId, edgeId }) => {
        edgeIds.add(edgeId);
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          queue.push(nodeId);
        }
      });
    }

    return { nodeIds, edgeIds };
  }, [layoutedEdges, selectedNodeId]);

  const nodes = useMemo(() => {
    if (!selectedNodeId) return layoutedNodes;

    return layoutedNodes.map((node) => {
      const isSelected = node.id === selectedNodeId;
      const isConnected = connectedGraph.nodeIds.has(node.id);
      return {
        ...node,
        style: {
          ...node.style,
          opacity: isConnected ? 1 : 0.78,
          border: isSelected ? '1px solid #e2e8f0' : node.style?.border,
          boxShadow: isSelected
            ? '0 0 0 2px rgba(248, 250, 252, 0.9), 0 12px 32px rgba(14, 165, 233, 0.22)'
            : isConnected
              ? node.style?.boxShadow
              : '0 6px 18px rgba(15, 23, 42, 0.18)',
          zIndex: isSelected ? 2 : 1,
        },
      };
    });
  }, [connectedGraph.nodeIds, layoutedNodes, selectedNodeId]);

  const edges = useMemo(() => {
    if (!selectedNodeId) return layoutedEdges;

    return layoutedEdges.map((edge) => {
      const isConnected = connectedGraph.edgeIds.has(edge.id);
      return {
        ...edge,
        animated: isConnected,
        style: {
          ...edge.style,
          opacity: isConnected ? 1 : 0.55,
          stroke: isConnected ? '#38bdf8' : '#475569',
          strokeWidth: isConnected ? 2.2 : 1.15,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: isConnected ? '#38bdf8' : '#475569',
        },
        labelStyle: {
          ...edge.labelStyle,
          fill: isConnected ? '#94a3b8' : '#475569',
          opacity: isConnected ? 1 : 0.72,
          fontWeight: isConnected ? 600 : 400,
        },
      };
    });
  }, [connectedGraph.edgeIds, layoutedEdges, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  return (
    <Grid
      gap='6'
      templateColumns={{ base: '1fr', lg: '1fr 320px' }}
      flex='1'
      minH='0'
    >
      <Card p='0' overflow='hidden' display='flex' flexDirection='column'>
        <Box flex='1' minH='600px' position='relative' bg='slate.950'>
          {isLayouting ? (
            <Stack
              h='full'
              align='center'
              justify='center'
              gap='3'
              color='slate.400'
            >
              <Spinner color='brand.400' />
              <Text fontSize='sm'>Calculating ELK layout...</Text>
            </Stack>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              fitViewOptions={{ padding: 0.16 }}
              style={{ width: '100%', height: '100%' }}
              minZoom={0.1}
              maxZoom={1}
            >
              <Background color='#334155' gap={20} />
              <Controls />
            </ReactFlow>
          )}
        </Box>
      </Card>

      <Stack gap='6' h='full' overflowY='auto' pr={1}>
        <Card>
          <Heading
            size='xs'
            color='white'
            mb='3'
            textTransform='uppercase'
            letterSpacing='wider'
          >
            Selected Node
          </Heading>
          {selectedNode ? (
            <NodeDetails selectedNode={selectedNode} />
          ) : (
            <Text fontSize='sm' color='slate.500'>
              Click a node to inspect it.
            </Text>
          )}
        </Card>
      </Stack>
    </Grid>
  );
}
