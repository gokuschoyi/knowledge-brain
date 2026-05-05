import { useQuery } from '@tanstack/react-query';
import { Box, Grid, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import { getBrains } from '../api/brains';
import { getDashboard } from '../api/dashboard';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';
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
    { label: 'Documents', value: data.documents },
    { label: 'Chunks', value: data.chunks },
    { label: 'Entities', value: data.entities },
    { label: 'Relationships', value: data.relationships },
    { label: 'Open repair tasks', value: data.open_self_healing_tasks },
    { label: 'Avg quality', value: data.average_quality_score },
  ];

  return (
    <Stack gap={6} p={6}>
      <Grid templateColumns={{ base: '1fr', xl: '1.2fr 0.8fr' }} gap={6}>
        <Card>
          <Stack gap='3'>
            <Box>
              <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
                Dashboard scope
              </Text>
              <Heading size='lg' mt='2' color='white'>
                {activeBrain ? activeBrain.name : 'All brains'}
              </Heading>
            </Box>
            <Text fontSize='sm' color='slate.400'>
              {activeBrain
                ? activeBrain.description ||
                  'Showing metrics for the selected brain.'
                : 'Showing rolled-up metrics across every brain in the workspace.'}
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap='2'>
            <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
              Metadata
            </Text>
            <Text fontSize='sm' color='slate.300'>
              {activeBrain
                ? `Created ${new Date(activeBrain.created_at).toLocaleDateString()}`
                : `${brainsQuery.data?.length ?? 0} brains available`}
            </Text>
            <Text fontSize='sm' color='slate.500'>
              {activeBrain
                ? `Updated ${new Date(activeBrain.updated_at).toLocaleDateString()}`
                : 'Use the header selector to scope the entire app.'}
            </Text>
          </Stack>
        </Card>
      </Grid>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={6}>
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <Text fontSize='sm' color='slate.400'>
              {label}
            </Text>
            <Heading size='xl' mt={2} color='white' fontWeight='semibold'>
              {value}
            </Heading>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
