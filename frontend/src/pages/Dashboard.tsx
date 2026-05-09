import { useQuery } from '@tanstack/react-query';
import {
  Grid,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import { getBrains } from '../api/brains';
import { getDashboard } from '../api/dashboard';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';
import { MetricTile } from '../components/common/MetricTile';
import { BrainHeroCard } from '../components/dashboard/BrainHeroCard';
import { NeuralBarChart } from '../components/dashboard/NeuralBarChart';
import { useActiveBrain } from '../context/useActiveBrain';

export function DashboardPage() {
  const { activeBrainId } = useActiveBrain();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeBrainId],
    queryFn: () => getDashboard(activeBrainId || undefined),
  });
  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });

  if (isLoading || brainsQuery.isLoading || !data) {
    return <LoadingState label='Loading dashboard...' />;
  }

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  const stats = [
    {
      label: 'Ingested Docs',
      value: data.documents,
      hint: `${data.hero.documents_completed} completed`,
      accent: 'rgba(99, 102, 241, 0.9)',
    },
    {
      label: 'Neural Nodes',
      value: data.entities,
      hint: `${data.relationships} relationships mapped`,
      accent: 'rgba(34, 211, 238, 0.9)',
    },
    {
      label: 'Open Repairs',
      value: data.open_self_healing_tasks,
      hint: `${data.hero.documents_failed} document failures`,
      accent: 'rgba(251, 191, 36, 0.9)',
    },
    {
      label: 'Chunk Volume',
      value: data.chunks,
      hint: `${data.hero.documents_processing} documents processing`,
      accent: 'rgba(148, 163, 184, 0.8)',
    },
  ];

  return (
    <Stack gap={6} p={6} h='full' minH='0' className='dashboard-page'>
      <Grid templateColumns={{ base: '1fr', xl: '1.4fr 0.85fr' }} gap={6}>
        <BrainHeroCard hero={data.hero} brainSummary={data.brain_summary} />

        <Card variant='panel'>
          <Stack gap='4' h='full'>
            <Text textStyle='sectionLabel'>Health Analytics</Text>
            <Heading
              textStyle='statValue'
              color='white'
              textShadow='0 0 24px rgba(99, 102, 241, 0.3)'
            >
              {data.quality_score_percent.toFixed(1)}%
            </Heading>
            <Text fontSize='sm' color='fgMuted'>
              Average document quality across the current scope.
            </Text>
            <NeuralBarChart data={data.analytics} />
          </Stack>
        </Card>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '1.15fr 0.85fr' }} gap={6}>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
          {stats.map(({ label, value, hint, accent }) => (
            <MetricTile
              key={label}
              label={label}
              value={value}
              hint={hint}
              accent={accent}
            />
          ))}
        </SimpleGrid>

        <Card variant='panel'>
          <Stack gap='4' justifyContent={'space-between'} h='full'>
            <VStack alignItems={'start'} gap='1'>
              <Text textStyle='sectionLabel'>Brain Metadata</Text>
              <Heading size='md' color='white'>
                {activeBrain ? activeBrain.name : 'All Brains'}
              </Heading>
              <Text fontSize='sm' color='fgMuted'>
                {activeBrain
                  ? activeBrain.description ||
                    'Selected brain has no custom description.'
                  : `${brainsQuery.data?.length ?? 0} brains available. Use the scope selector to narrow the entire workspace.`}
              </Text>
            </VStack>
            <SimpleGrid columns={2} gap='3'>
              <MetricTile
                label='Created'
                value={
                  activeBrain
                    ? new Date(activeBrain.created_at).toLocaleDateString()
                    : 'Global'
                }
                minH='0'
                px='4'
                py='4'
              />
              <MetricTile
                label='Updated'
                value={
                  activeBrain
                    ? new Date(activeBrain.updated_at).toLocaleDateString()
                    : 'Live'
                }
                minH='0'
                px='4'
                py='4'
              />
            </SimpleGrid>
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}
