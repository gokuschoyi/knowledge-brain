import {
  Badge,
  Box,
  Flex,
  Grid,
  Progress,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react';

import type {
  IngestionChunkDetail,
  IngestionJob,
  IngestionLogEntry,
  IngestionStage,
} from '../../api/types';
import { Card } from '../common/Card';

const stagePalette: Record<IngestionStage['status'], string> = {
  pending: 'gray',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  skipped: 'gray',
  warning: 'orange',
};

const chunkPalette: Record<IngestionChunkDetail['status'], string> = {
  pending: 'gray',
  queued: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

export function IngestionProgress({ job }: { job: IngestionJob | null }) {
  if (!job) return null;

  const failedChunks = job.chunk_details.filter(
    (chunk) => chunk.status === 'failed',
  );

  return (
    <Card display='flex' flexDirection='column' minH='400px' maxH='560px'>
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

      <Grid
        templateColumns={{ base: '1fr 1fr', md: 'repeat(5, 1fr)' }}
        gap='2'
        mb='4'
      >
        <ChunkCounter label='Total' value={job.chunk_progress.total} />
        <ChunkCounter label='Queued' value={job.chunk_progress.queued} />
        <ChunkCounter label='Running' value={job.chunk_progress.running} />
        <ChunkCounter label='Completed' value={job.chunk_progress.completed} />
        <ChunkCounter label='Failed' value={job.chunk_progress.failed} />
      </Grid>

      <Tabs.Root
        defaultValue='stages'
        variant='enclosed'
        size='sm'
        flex='1'
        display='flex'
        flexDirection='column'
        minH='0'
      >
        <Tabs.List bg='slate.900' borderRadius='md' p='1' mb='4'>
          <Tabs.Trigger value='stages' flex='1' py='2'>
            Stages
          </Tabs.Trigger>
          <Tabs.Trigger value='chunks' flex='1' py='2'>
            Chunk Status
          </Tabs.Trigger>
          <Tabs.Trigger value='logs' flex='1' py='2'>
            Event Logs
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value='stages' overflowY='auto' pr='1'>
          <Stack gap='2'>
            {job.stages.map((stage) => (
              <Flex
                key={stage.key}
                justify='space-between'
                align='start'
                gap='3'
                p='2'
                borderRadius='md'
                bg='whiteAlpha.50'
              >
                <Box minW='0'>
                  <Text fontSize='sm' color='white'>
                    {stage.label}
                  </Text>
                  <Text fontSize='xs' color='slate.400'>
                    {stage.message || 'Waiting to start'}
                  </Text>
                </Box>
                <Badge
                  colorPalette={stagePalette[stage.status]}
                  variant='subtle'
                  textTransform='capitalize'
                >
                  {stage.status}
                </Badge>
              </Flex>
            ))}
          </Stack>
        </Tabs.Content>

        <Tabs.Content value='chunks' overflowY='auto' pr='1'>
          <Stack gap='3'>
            {failedChunks.length > 0 && (
              <Box>
                <Text
                  fontSize='xs'
                  textTransform='uppercase'
                  letterSpacing='0.08em'
                  color='red.400'
                  mb='2'
                  fontWeight='bold'
                >
                  Failures
                </Text>
                <Stack gap='2' mb='4'>
                  {failedChunks.map((chunk) => (
                    <Box
                      key={`failed-${chunk.chunk_id}`}
                      borderWidth='1px'
                      borderColor='red.900'
                      borderRadius='md'
                      p='2'
                      bg='red.950/20'
                    >
                      <Text fontSize='sm' color='red.200' fontWeight='semibold'>
                        Chunk {chunk.chunk_index + 1}
                      </Text>
                      <Text fontSize='xs' color='slate.300'>
                        {chunk.error_message || 'Chunk extraction failed.'}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {job.chunk_details.length > 0 ? (
              <Box>
                <Text
                  fontSize='xs'
                  textTransform='uppercase'
                  letterSpacing='0.08em'
                  color='slate.500'
                  mb='2'
                >
                  All Chunks
                </Text>
                <Grid
                  templateColumns='repeat(auto-fill, minmax(140px, 1fr))'
                  gap='2'
                >
                  {job.chunk_details.map((chunk) => (
                    <Flex
                      key={chunk.chunk_id}
                      justify='space-between'
                      align='center'
                      gap='2'
                      p='2'
                      bg='whiteAlpha.50'
                      borderRadius='md'
                    >
                      <Text fontSize='xs' color='slate.300' truncate>
                        #{chunk.chunk_index + 1}
                      </Text>
                      <Badge
                        colorPalette={chunkPalette[chunk.status]}
                        variant='subtle'
                        size='xs'
                        textTransform='capitalize'
                      >
                        {chunk.status}
                      </Badge>
                    </Flex>
                  ))}
                </Grid>
              </Box>
            ) : (
              <Flex align='center' justify='center' h='100px' color='slate.500'>
                <Text fontSize='sm'>No chunk data available yet.</Text>
              </Flex>
            )}
          </Stack>
        </Tabs.Content>

        <Tabs.Content value='logs' overflowY='auto' pr='1'>
          <Stack gap='2'>
            {job.log.length > 0 ? (
              job.log.map((entry: IngestionLogEntry, index: number) => (
                <Box
                  key={`${entry.step}-${index}`}
                  fontSize='xs'
                  fontFamily='mono'
                  p='2'
                  bg='blackAlpha.300'
                  borderRadius='sm'
                  borderLeft='2px solid'
                  borderLeftColor='slate.700'
                >
                  <Text as='span' color='brand.400' mr='2' fontWeight='bold'>
                    [{entry.step}]
                  </Text>
                  <Text as='span' color='slate.300'>
                    {entry.message}
                  </Text>
                </Box>
              ))
            ) : (
              <Flex align='center' justify='center' h='100px' color='slate.500'>
                <Text fontSize='sm'>Waiting for logs...</Text>
              </Flex>
            )}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Card>
  );
}

function ChunkCounter({ label, value }: { label: string; value: number }) {
  return (
    <Box borderWidth='1px' borderColor='whiteAlpha.200' borderRadius='lg' p='2'>
      <Text fontSize='xs' color='slate.500'>
        {label}
      </Text>
      <Text fontSize='sm' color='white' fontWeight='semibold'>
        {value}
      </Text>
    </Box>
  );
}
