import { useQuery } from '@tanstack/react-query';
import { Stack, Text } from '@chakra-ui/react';

import { getBrains } from '../api/brains';
import { getGraph } from '../api/graph';
import { Card } from '../components/common/Card';
import { GraphLegend } from '../components/graph/GraphLegend';
import { KnowledgeGraphView } from '../components/graph/KnowledgeGraphView';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

export function KnowledgeGraphPage() {
  const { activeBrainId } = useActiveBrain();
  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['graph', activeBrainId],
    queryFn: () => getGraph(activeBrainId || undefined),
    enabled: !!activeBrainId,
  });

  if (brainsQuery.isLoading) {
    return <LoadingState label='Loading brains...' />;
  }

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Card>
        <Text fontSize='sm' color='slate.400'>
          Select an active brain in the header to load its knowledge graph.
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap='6' h='full' p={6}>
      {isLoading || !data ? (
        <LoadingState label='Loading graph...' />
      ) : (
        <KnowledgeGraphView graph={data} />
      )}
      <GraphLegend activeBrainName={activeBrain.name} />
    </Stack>
  );
}
