import { Grid, Heading, Text } from '@chakra-ui/react';

import { Card } from '../common/Card';

type Summary = {
  pending: number;
  running: number;
  resolved: number;
  unresolved: number;
  reviewRequired: number;
  failed: number;
};

type Props = {
  summary: Summary;
};

export function SelfHealingMetrics({ summary }: Props) {
  return (
    <Grid templateColumns={{ base: '1fr 1fr', xl: 'repeat(6, 1fr)' }} gap='4'>
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
          Resolved
        </Text>
        <Heading size='lg' color='green.300'>
          {summary.resolved}
        </Heading>
      </Card>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Unresolved
        </Text>
        <Heading size='lg' color='orange.300'>
          {summary.unresolved}
        </Heading>
      </Card>
      <Card variant='metric' px={4} py={3}>
        <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Review
        </Text>
        <Heading size='lg' color='purple.300'>
          {summary.reviewRequired}
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
