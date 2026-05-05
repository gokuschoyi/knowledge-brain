import { useQuery } from '@tanstack/react-query';
import { SimpleGrid, Text, Heading } from '@chakra-ui/react';

import { getDashboard } from '../api/dashboard';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading || !data) return <LoadingState label='Loading dashboard...' />;

  const stats = [
    { label: 'Documents', value: data.documents },
    { label: 'Chunks', value: data.chunks },
    { label: 'Entities', value: data.entities },
    { label: 'Relationships', value: data.relationships },
    { label: 'Open repair tasks', value: data.open_self_healing_tasks },
    { label: 'Avg quality', value: data.average_quality_score },
  ];

  return (
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
  );
}
