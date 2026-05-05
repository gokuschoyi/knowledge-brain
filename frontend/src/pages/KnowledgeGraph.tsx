import { useQuery } from '@tanstack/react-query';
import { Stack } from '@chakra-ui/react';
import { getGraph } from '../api/graph';
import { GraphLegend } from '../components/graph/GraphLegend';
import { KnowledgeGraphView } from '../components/graph/KnowledgeGraphView';
import { LoadingState } from '../components/common/LoadingState';

export function KnowledgeGraphPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['graph'],
    queryFn: getGraph,
  });

  if (isLoading || !data) return <LoadingState label='Loading graph...' />;

  return (
    <Stack gap='6' h='full'>
      <GraphLegend />
      <KnowledgeGraphView graph={data} />
    </Stack>
  );
}
