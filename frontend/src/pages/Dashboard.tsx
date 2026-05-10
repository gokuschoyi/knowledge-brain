import { useQuery } from '@tanstack/react-query';
import {
  ButtonGroup,
  Grid,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

import { getBrains } from '../api/brains';
import { getDashboard } from '../api/dashboard';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';
import { MetricTile } from '../components/common/MetricTile';
import { BrainHeroCard } from '../components/dashboard/BrainHeroCard';
import { NeuralBarChart } from '../components/dashboard/NeuralBarChart';
import { useActiveBrain } from '../context/useActiveBrain';

export function DashboardPage() {
  const { activeBrainId } = useActiveBrain();
  const navigate = useNavigate();
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
      label: 'Contradictions',
      value: data.unresolved_contradictions,
      hint: `${data.unresolved_low_confidence} unanswered gaps`,
      accent: 'rgba(251, 191, 36, 0.9)',
    },
    {
      label: 'Evidence Trust',
      value: `${data.trust_score_percent.toFixed(0)}%`,
      hint: `${data.authority_coverage_percent.toFixed(0)}% authority · ${data.freshness_coverage_percent.toFixed(0)}% freshness`,
      accent: 'rgba(148, 163, 184, 0.8)',
    },
  ];

  return (
    <Stack
      gap={6}
      p={6}
      h='full'
      minH='0'
      overflowY='auto'
      className='dashboard-page'
    >
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
              Composite score from source authority, freshness, claim review
              coverage, and contradiction pressure.
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
              <Text textStyle='sectionLabel'>Recommended Actions</Text>
              <Heading size='md' color='white'>
                Next best cleanup steps
              </Heading>
              <Text fontSize='sm' color='fgMuted'>
                Focus the team on the changes most likely to improve trust and
                retrieval quality.
              </Text>
            </VStack>
            <Stack gap='3'>
              {data.recommended_actions.map((action) => (
                <Card key={action.href} variant='metric' px='4' py='4'>
                  <Stack
                    direction={{ base: 'column', md: 'row' }}
                    gap='3'
                    justify='space-between'
                    align={{ base: 'stretch', md: 'center' }}
                  >
                    <Stack gap='1'>
                      <Text
                        fontSize='xs'
                        color='slate.500'
                        textTransform='uppercase'
                      >
                        {action.label}
                      </Text>
                      <Heading size='md' color='white'>
                        {action.count}
                      </Heading>
                    </Stack>
                    <ButtonGroup>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => navigate(action.href)}
                      >
                        Open
                      </Button>
                    </ButtonGroup>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}
