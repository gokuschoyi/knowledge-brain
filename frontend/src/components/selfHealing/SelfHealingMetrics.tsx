import { Grid, Heading, Text } from '@chakra-ui/react';

import { Card } from '../common/Card';

type Summary = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

type Props = {
  summary: Summary;
};

export function SelfHealingMetrics({ summary }: Props) {
  return (
    <Grid templateColumns={{ base: '1fr 1fr', xl: 'repeat(4, 1fr)' }} gap='4'>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Pending
        </Text>
        <Heading size='lg' color='orange.300'>
          {summary.pending}
        </Heading>
      </Card>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Running
        </Text>
        <Heading size='lg' color='blue.300'>
          {summary.running}
        </Heading>
      </Card>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Completed
        </Text>
        <Heading size='lg' color='green.300'>
          {summary.completed}
        </Heading>
      </Card>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Failed
        </Text>
        <Heading size='lg' color='red.300'>
          {summary.failed}
        </Heading>
      </Card>
    </Grid>
  );
}
