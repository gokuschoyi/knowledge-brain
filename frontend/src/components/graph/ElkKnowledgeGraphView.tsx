import { useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  type ReactFlowInstance,
} from 'reactflow';
import type { Edge, Node as FlowNode } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Badge,
  Box,
  Grid,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Search, X } from 'lucide-react';

import type { GraphResponse } from '../../api/types';
import { Card } from '../common/Card';
import { NodeDetails } from './NodeDetails';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;
const elk = new ELK();
const SEARCH_RESULT_LIMIT = 8;

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

function getBaseNodes(graph: GraphResponse): FlowNode[] {
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
    labelBgStyle: {
      fill: 'rgba(15, 23, 42, 0.88)',
      fillOpacity: 1,
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
      'elk.spacing.nodeNode': '80',
      'elk.spacing.edgeNode': '60',
      'elk.layered.unnecessaryBendpoints': 'false',
      'elk.layered.compaction.connectedComponents': 'true',
      'elk.layered.nodePlacement.favorStraightEdges': 'false',
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

type SearchResult = {
  nodeId: string;
  label: string;
  aliases: string[];
  score: number;
};

export function ElkKnowledgeGraphView({ graph }: { graph: GraphResponse }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutedNodes, setLayoutedNodes] = useState<FlowNode[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);
  const [isLayouting, setIsLayouting] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const searchOverlayRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchOverlayRef.current) return;
      if (searchOverlayRef.current.contains(event.target as globalThis.Node))
        return;
      setIsSearchFocused(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

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
          opacity: isConnected ? 1 : 0.28,
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
          opacity: isConnected ? 1 : 0.14,
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
          opacity: isConnected ? 1 : 0.22,
          fontWeight: isConnected ? 600 : 400,
        },
        labelBgStyle: {
          ...edge.labelBgStyle,
          fill: isConnected
            ? 'rgba(15, 23, 42, 0.88)'
            : 'rgba(15, 23, 42, 0.2)',
          fillOpacity: isConnected ? 1 : 0.2,
        },
      };
    });
  }, [connectedGraph.edgeIds, layoutedEdges, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return [] as SearchResult[];

    return graph.nodes
      .map((node) => {
        const label = String(node.label || node.id);
        const aliases = Array.isArray(
          (node.data as { aliases?: unknown })?.aliases,
        )
          ? ((node.data as { aliases?: string[] }).aliases ?? [])
          : [];
        const normalizedLabel = label.toLowerCase();
        const normalizedAliases = aliases.map((alias) => alias.toLowerCase());

        let score = -1;
        if (normalizedLabel === term) {
          score = 0;
        } else if (normalizedLabel.startsWith(term)) {
          score = 1;
        } else if (normalizedAliases.some((alias) => alias === term)) {
          score = 2;
        } else if (normalizedAliases.some((alias) => alias.startsWith(term))) {
          score = 3;
        } else if (normalizedLabel.includes(term)) {
          score = 4;
        } else if (normalizedAliases.some((alias) => alias.includes(term))) {
          score = 5;
        }

        return {
          nodeId: node.id,
          label,
          aliases,
          score,
        };
      })
      .filter((result) => result.score >= 0)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, SEARCH_RESULT_LIMIT);
  }, [graph.nodes, searchQuery]);

  const shouldShowSearchDropdown =
    isSearchFocused && searchQuery.trim().length > 0;

  function selectNode(nodeId: string, label?: string) {
    setSelectedNodeId(nodeId);
    setIsSearchFocused(false);
    if (label) {
      setSearchQuery(label);
    }
  }

  useEffect(() => {
    if (!selectedNodeId || !reactFlowInstance || isLayouting) return;
    const selectedLayoutNode = layoutedNodes.find(
      (node) => node.id === selectedNodeId,
    );
    if (!selectedLayoutNode?.position) return;

    reactFlowInstance.setCenter(
      selectedLayoutNode.position.x + NODE_WIDTH / 2,
      selectedLayoutNode.position.y + NODE_HEIGHT / 2,
      {
        duration: 500,
        zoom: Math.max(reactFlowInstance.getZoom(), 0.35),
      },
    );
  }, [isLayouting, layoutedNodes, reactFlowInstance, selectedNodeId]);

  return (
    <Grid
      gap='6'
      templateColumns={{ base: '1fr', lg: '1fr 320px' }}
      flex='1'
      minH='0'
    >
      <Card p='0' overflow='hidden' display='flex' flexDirection='column'>
        <Box flex='1' minH='600px' position='relative' bg='slate.950'>
          <Box
            ref={searchOverlayRef}
            position='absolute'
            top='4'
            right='4'
            zIndex='5'
            w='min(360px, calc(100% - 2rem))'
          >
            <Box
              bg='rgba(15, 23, 42, 0.84)'
              border='1px solid'
              borderColor='whiteAlpha.200'
              borderRadius='full'
              px='3'
              py='2.5'
              boxShadow='0 14px 30px rgba(2, 6, 23, 0.34)'
              backdropFilter='blur(12px)'
            >
              <HStack gap='2'>
                <Search size={14} color='#94a3b8' />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && searchResults.length > 0) {
                      event.preventDefault();
                      selectNode(
                        searchResults[0].nodeId,
                        searchResults[0].label,
                      );
                    }
                    if (event.key === 'Escape') {
                      setIsSearchFocused(false);
                    }
                  }}
                  placeholder='Search graph nodes...'
                  color='white'
                  bg='transparent'
                  borderWidth='0'
                  px='0'
                  h='auto'
                  minH='0'
                  _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                  _placeholder={{ color: 'slate.500' }}
                />
                {searchQuery ? (
                  <Box
                    as='button'
                    aria-label='Clear graph search'
                    color='slate.400'
                    _hover={{ color: 'white' }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }}
                  >
                    <X size={14} />
                  </Box>
                ) : null}
              </HStack>
            </Box>

            {shouldShowSearchDropdown ? (
              <Box
                mt='2'
                bg='rgba(15, 23, 42, 0.92)'
                border='1px solid'
                borderColor='whiteAlpha.200'
                borderRadius='xl'
                overflow='hidden'
                boxShadow='0 18px 36px rgba(2, 6, 23, 0.38)'
                backdropFilter='blur(12px)'
              >
                {searchResults.length > 0 ? (
                  <Stack gap='0' py='1'>
                    {searchResults.map((result) => (
                      <Box
                        key={result.nodeId}
                        px='3'
                        py='2.5'
                        cursor='pointer'
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectNode(result.nodeId, result.label);
                        }}
                      >
                        <HStack justify='space-between' align='start' gap='3'>
                          <Box minW='0'>
                            <Text fontSize='sm' color='white' truncate>
                              {result.label}
                            </Text>
                            {result.aliases.length > 0 ? (
                              <Text fontSize='xs' color='slate.400' truncate>
                                {result.aliases.slice(0, 3).join(', ')}
                              </Text>
                            ) : null}
                          </Box>
                          {selectedNodeId === result.nodeId ? (
                            <Badge
                              colorPalette='brand'
                              variant='subtle'
                              borderRadius='full'
                              px='2'
                            >
                              Selected
                            </Badge>
                          ) : null}
                        </HStack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box px='3' py='3'>
                    <Text fontSize='sm' color='slate.400'>
                      No matching nodes
                    </Text>
                  </Box>
                )}
              </Box>
            ) : null}
          </Box>

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
              onInit={setReactFlowInstance}
              onNodeClick={(_, node) =>
                selectNode(node.id, String(node.data?.label || node.id))
              }
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              fitViewOptions={{ padding: 0.16 }}
              style={{ width: '100%', height: '100%' }}
              minZoom={0.01}
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
