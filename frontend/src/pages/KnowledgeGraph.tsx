import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Text } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

import { getBrains } from '../api/brains';
import type { GraphNode } from '../api/types';
import { getGraph } from '../api/graph';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
// import { KnowledgeGraphView } from 'components/graph/KnowledgeGraphView';
import { ElkKnowledgeGraphView } from '../components/graph/ElkKnowledgeGraphView';
// import { GraphLegend } from '../components/graph/GraphLegend';
import { GraphTabBar } from '../components/graph/GraphTabBar';
import { IsolatedEntitiesPanel } from '../components/graph/IsolatedEntitiesPanel';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

type GraphTab = 'graph' | 'isolated';

export function KnowledgeGraphPage() {
  const { activeBrainId } = useActiveBrain();
  const location = useLocation();
  const [tab, setTab] = useState<GraphTab>(() =>
    new URLSearchParams(location.search).get('tab') === 'isolated'
      ? 'isolated'
      : 'graph',
  );
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
  const hasAnyGraphData =
    partitioned.connectedGraph.nodes.length > 0 ||
    partitioned.isolatedEntities.length > 0;

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
      ) : !hasAnyGraphData ? (
        <Box>
          <EmptyState
            title='No graph data for this brain'
            body='Ingest more material into this brain to extract entities and relationships for the knowledge graph.'
          />
        </Box>
      ) : (
        <>
          <Card variant='panel' py={3}>
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
              <GraphTabBar
                tab={tab}
                connectedCount={partitioned.connectedGraph.nodes.length}
                isolatedCount={partitioned.isolatedEntities.length}
                onTabChange={setTab}
              />
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
