import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react';

import { getBrains } from '../api/brains';
import type { GraphNode } from '../api/types';
import { getGraph } from '../api/graph';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
// import { KnowledgeGraphView } from 'components/graph/KnowledgeGraphView';
import { ElkKnowledgeGraphView } from '../components/graph/ElkKnowledgeGraphView';
// import { GraphLegend } from '../components/graph/GraphLegend';
import { IsolatedEntitiesPanel } from '../components/graph/IsolatedEntitiesPanel';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

type GraphTab = 'graph' | 'isolated';

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'solid' : 'outline'}
      onClick={onClick}
      borderColor={active ? undefined : 'slate.700'}
      color={active ? undefined : 'slate.200'}
      bg={active ? 'brand.500' : 'slate.900'}
      _hover={{
        bg: active ? 'brand.400' : 'slate.800',
      }}
    >
      <HStack gap='2'>
        <Text>{label}</Text>
        <Badge
          bg={active ? 'rgba(255,255,255,0.18)' : 'slate.800'}
          color={active ? 'white' : 'slate.300'}
          borderRadius='full'
          px='2'
        >
          {count}
        </Badge>
      </HStack>
    </Button>
  );
}

export function KnowledgeGraphPage() {
  const { activeBrainId } = useActiveBrain();
  const [tab, setTab] = useState<GraphTab>('graph');
  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['graph', activeBrainId],
    queryFn: () => getGraph(activeBrainId || undefined),
    enabled: !!activeBrainId,
  });

  const partitioned = useMemo(
    () =>
      data
        ? {
            connectedGraph: data.connected_graph,
            isolatedEntities: data.isolated_entities,
          }
        : {
            connectedGraph: { nodes: [] as GraphNode[], edges: [] },
            isolatedEntities: [] as GraphNode[],
          },
    [data],
  );

  if (brainsQuery.isLoading) {
    return <LoadingState label='Loading brains...' />;
  }

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Box p={6}>
        <Card>
          <Text fontSize='sm' color='slate.400'>
            Select an active brain in the header to load its knowledge graph.
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Stack gap='6' h='full' p={6}>
      {isLoading || !data ? (
        <LoadingState label='Loading graph...' />
      ) : (
        <>
          <Card py={3}>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              gap='4'
              align={{ base: 'stretch', md: 'center' }}
              justify='space-between'
            >
              <Box>
                <Text fontSize='sm' color='slate.300'>
                  The main graph only shows entities that participate in at
                  least one relationship.
                </Text>
                <Text mt='1' fontSize='xs' color='slate.500'>
                  Isolated entities are kept in a separate review view so the
                  graph stays readable.
                </Text>
              </Box>
              <HStack gap='3' wrap='wrap'>
                <TabButton
                  active={tab === 'graph'}
                  label='Graph'
                  count={partitioned.connectedGraph.nodes.length}
                  onClick={() => setTab('graph')}
                />
                <TabButton
                  active={tab === 'isolated'}
                  label='Isolated Entities'
                  count={partitioned.isolatedEntities.length}
                  onClick={() => setTab('isolated')}
                />
              </HStack>
            </Stack>
          </Card>

          {tab === 'graph' ? (
            <>
              {partitioned.connectedGraph.nodes.length > 0 ? (
                <ElkKnowledgeGraphView graph={partitioned.connectedGraph} />
              ) : (
                <EmptyState
                  title='No connected entities yet'
                  body='This brain has extracted entities, but none of them are linked by relationships yet.'
                />
              )}
              {/* <GraphLegend activeBrainName={activeBrain.name} /> */}
            </>
          ) : (
            <IsolatedEntitiesPanel entities={partitioned.isolatedEntities} />
          )}
        </>
      )}
    </Stack>
  );
}
