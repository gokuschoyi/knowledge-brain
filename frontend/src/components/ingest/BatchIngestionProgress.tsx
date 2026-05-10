import { useState } from 'react';
import {
  Badge,
  Box,
  Collapsible,
  Flex,
  Grid,
  Progress,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { BatchJobResponse } from '../../api/types';
import { Card } from '../common/Card';
import { IngestionProgress } from './IngestionProgress';

const jobStatusPalette: Record<string, string> = {
  pending: 'gray',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
};

interface BatchIngestionProgressProps {
  batchStatus: BatchJobResponse | null;
  onRetryChunk: (documentId: number, chunkId: number) => Promise<void>;
  fillAvailableSpace?: boolean;
}

export function BatchIngestionProgress({
  batchStatus,
  onRetryChunk,
  fillAvailableSpace = false,
}: BatchIngestionProgressProps) {
  const [expandedJobIds, setExpandedJobIds] = useState<Set<number>>(new Set());

  if (!batchStatus) return null;

  const { jobs, summary } = batchStatus;

  const toggleJob = (id: number) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (jobs.length === 1) {
    const job = jobs[0];
    return (
      <IngestionProgress
        job={job}
        onRetryChunk={(chunkId) => onRetryChunk(job.document, chunkId)}
        fillAvailableSpace={fillAvailableSpace}
      />
    );
  }

  return (
    <Card
      variant='panel'
      display='flex'
      flexDirection='column'
      flex={fillAvailableSpace ? '1' : '0 0 auto'}
      minH={fillAvailableSpace ? '0' : '420px'}
      maxH={fillAvailableSpace ? 'none' : '560px'}
      flexShrink='0'
      overflow='hidden'
    >
      <Flex mb='3' align='center' justify='space-between'>
        <Box>
          <Text fontSize='sm' fontWeight='semibold' color='white'>
            Ingestion Feed
          </Text>
          <Text fontSize='xs' color='fgMuted'>
            {summary.total} file{summary.total !== 1 ? 's' : ''} · {summary.overall_progress}% overall
          </Text>
        </Box>
        <Text fontSize='sm' color='cyan.300'>
          {summary.overall_progress}%
        </Text>
      </Flex>

      <Progress.Root
        value={summary.overall_progress}
        colorPalette='brand'
        size='sm'
        borderRadius='full'
        mb='4'
      >
        <Progress.Track bg='rgba(15, 23, 42, 0.8)'>
          <Progress.Range borderRadius='full' />
        </Progress.Track>
      </Progress.Root>

      <Grid templateColumns='repeat(4, 1fr)' gap='2' mb='4'>
        <BatchCounter label='Completed' value={summary.completed} color='green.400' />
        <BatchCounter label='Processing' value={summary.processing + summary.pending} color='blue.400' />
        <BatchCounter label='Failed' value={summary.failed} color='red.400' />
        <BatchCounter label='Total' value={summary.total} color='white' />
      </Grid>

      <Stack gap='2' flex='1' minH='0' overflowY='auto'>
        {jobs.map((job) => {
          const isExpanded = expandedJobIds.has(job.id);
          return (
            <Box key={job.id}>
              <Collapsible.Root open={isExpanded}>
                <Collapsible.Trigger
                  asChild
                  onClick={() => toggleJob(job.id)}
                >
                  <Flex
                    justify='space-between'
                    align='center'
                    gap='3'
                    p='2'
                    borderRadius='md'
                    bg='rgba(8, 17, 33, 0.93)'
                    cursor='pointer'
                    _hover={{ bg: 'rgba(15, 28, 55, 0.95)' }}
                    w='full'
                  >
                    <Flex align='center' gap='2' minW='0'>
                      {isExpanded
                        ? <ChevronDown size={14} color='var(--chakra-colors-slate-400)' />
                        : <ChevronRight size={14} color='var(--chakra-colors-slate-400)' />
                      }
                      <Text fontSize='sm' color='white' truncate>
                        {job.document_title || `Document #${job.document}`}
                      </Text>
                    </Flex>
                    <Flex align='center' gap='2' flexShrink={0}>
                      <Text fontSize='xs' color='fgMuted'>
                        {job.progress}%
                      </Text>
                      <Badge
                        colorPalette={jobStatusPalette[job.status] ?? 'gray'}
                        variant='subtle'
                        size='xs'
                        textTransform='capitalize'
                      >
                        {job.status}
                      </Badge>
                    </Flex>
                  </Flex>
                </Collapsible.Trigger>

                <Collapsible.Content>
                  <Box pt='2' pl='2'>
                    <IngestionProgress
                      job={job}
                      onRetryChunk={(chunkId) => onRetryChunk(job.document, chunkId)}
                    />
                  </Box>
                </Collapsible.Content>
              </Collapsible.Root>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}

function BatchCounter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box borderWidth='1px' borderColor='whiteAlpha.200' borderRadius='lg' p='2'>
      <Text fontSize='xs' color='slate.500'>
        {label}
      </Text>
      <Text fontSize='sm' color={color} fontWeight='semibold'>
        {value}
      </Text>
    </Box>
  );
}
