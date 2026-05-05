import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Heading, Text, Stack, Grid, Code } from '@chakra-ui/react';
import type { GraphResponse } from '../../api/types';
import { Card } from '../common/Card';

export function KnowledgeGraphView({ graph }: { graph: GraphResponse }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodes = useMemo(() => {
    const documentNodes = graph.nodes.filter(
      (node) => node.type === 'document',
    );
    const entityNodes = graph.nodes.filter((node) => node.type !== 'document');

    const positionedDocuments = documentNodes.map((node, index) => ({
      ...node,
      type: 'default',
      position: node.position ?? { x: 80, y: 80 + index * 140 },
      data: {
        originalType: node.type,
        label: node.label ?? node.id,
        ...(node.data || {}),
      },
    }));

    const positionedEntities = entityNodes.map((node, index) => ({
      ...node,
      type: 'default',
      position: node.position ?? {
        x: 420 + (index % 3) * 260,
        y: 80 + Math.floor(index / 3) * 140,
      },
      data: {
        originalType: node.type,
        label: node.label ?? node.id,
        ...(node.data || {}),
      },
    }));

    return [...positionedDocuments, ...positionedEntities];
  }, [graph.nodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const nodeData = selectedNode.data || {};
    if ('embedding' in nodeData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = nodeData;
      return rest;
    }
    return nodeData;
  }, [selectedNode]);

  return (
    <Grid
      gap='6'
      templateColumns={{ base: '1fr', lg: '1fr 320px' }}
      flex='1'
      minH='0'
    >
      <Card p='0' overflow='hidden' display='flex' flexDirection='column'>
        <Box flex='1' minH='600px' position='relative' bg='slate.950'>
          <ReactFlow
            nodes={nodes}
            edges={graph.edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Background color='#334155' gap={20} />
            <Controls />
          </ReactFlow>
        </Box>
      </Card>

      <Stack gap='6'>
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
          {selectedNodeData ? (
            <Code
              variant='plain'
              bg='transparent'
              p='0'
              fontSize='xs'
              color='slate.300'
              whiteSpace='pre-wrap'
              wordBreak='break-word'
            >
              {JSON.stringify(selectedNodeData, null, 2)}
            </Code>
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
