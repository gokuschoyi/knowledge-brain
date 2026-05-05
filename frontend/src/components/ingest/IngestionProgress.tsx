import { Progress, Stack, Text, Box, Flex } from '@chakra-ui/react';
import type { IngestionJob, IngestionLogEntry } from '../../api/types';
import { Card } from '../common/Card';

export function IngestionProgress({ job }: { job: IngestionJob | null }) {
  if (!job) return null;

  return (
    <Card>
      <Flex mb='3' align='center' justify='space-between'>
        <Box>
          <Text fontSize='sm' fontWeight='semibold' color='white'>
            Ingestion progress
          </Text>
          <Text fontSize='xs' color='slate.400'>
            {job.current_step || 'Queued'}
          </Text>
        </Box>
        <Text fontSize='sm' color='brand.400'>
          {job.progress}%
        </Text>
      </Flex>

      <Progress.Root
        value={job.progress}
        colorPalette='brand'
        size='sm'
        borderRadius='full'
        mb='4'
      >
        <Progress.Track bg='slate.800'>
          <Progress.Range borderRadius='full' />
        </Progress.Track>
      </Progress.Root>

      <Stack gap='2'>
        {job.log.map((entry: IngestionLogEntry, index: number) => (
          <Text key={`${entry.step}-${index}`} fontSize='sm' color='slate.300'>
            <Text as='span' color='slate.500' mr='2'>
              {entry.step}
            </Text>
            {entry.message}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}
