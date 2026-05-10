import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
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

interface IngestionProgressProps {
  job: IngestionJob | null;
  onRetryChunk?: (chunkId: number) => Promise<void>;
  fillAvailableSpace?: boolean;
  maxHeight?: string | number;
}

export function IngestionProgress({
  job,
  onRetryChunk,
  fillAvailableSpace = false,
  maxHeight,
}: IngestionProgressProps) {
  const [retrying, setRetrying] = useState<Set<number>>(new Set());

  if (!job) return null;

  const failedChunks = job.chunk_details.filter(
    (chunk) => chunk.status === 'failed',
  );

  const handleRetry = async (chunkId: number) => {
    setRetrying((prev) => new Set(prev).add(chunkId));
    try {
      await onRetryChunk?.(chunkId);
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(chunkId);
        return next;
      });
    }
  };

  return (
    <Card
      variant='panel'
      display='flex'
      flexDirection='column'
      flex={fillAvailableSpace ? '1' : '0 0 auto'}
      minH={fillAvailableSpace ? '0' : '420px'}
      h={fillAvailableSpace ? 'full' : undefined}
      maxH={maxHeight ?? (fillAvailableSpace ? 'none' : '560px')}
      flexShrink='0'
      overflow='hidden'
    >
      <Flex mb='3' align='center' justify='space-between'>
        <Box>
          <Text fontSize='sm' fontWeight='semibold' color='white'>
            Recent Feed
          </Text>
          <Text fontSize='xs' color='fgMuted'>
            {job.current_step || 'Queued'}
          </Text>
        </Box>
        <Text fontSize='sm' color='cyan.300'>
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
        <Progress.Track bg='rgba(15, 23, 42, 0.8)'>
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
        size='sm'
        flex='1 1 0%'
        display='flex'
        flexDirection='column'
        minH='0'
        overflow='hidden'
      >
        <Tabs.List
          bg='rgba(148, 163, 184, 0.06)'
          border='1px solid'
          borderColor='whiteAlpha.100'
          borderRadius='xl'
          gap={2}
          mb='4'
          p={1}
          backdropFilter='blur(12px)'
          boxShadow='inset 0 1px 0 rgba(255,255,255,0.025)'
          flexShrink={0}
        >
          <Tabs.Trigger
            value='stages'
            flex='1'
            px='3'
            borderRadius='md'
            bg='transparent'
            color='fgMuted'
            fontWeight='600'
            borderBottom='2px solid'
            borderBottomColor='transparent'
            transition='all 0.18s ease'
            _before={{ display: 'none', content: 'none' }}
            _hover={{ color: 'white', bg: 'rgba(255,255,255,0.03)' }}
            _selected={{
              color: 'white',
              bg: 'rgba(255,255,255,0.04)',
              borderBottomColor: 'brandCyan',
              borderBottomWidth: 'none',
            }}
            display={'flex'}
            justifyContent={'center'}
          >
            Stages
          </Tabs.Trigger>
          <Tabs.Trigger
            value='chunks'
            flex='1'
            py='2.5'
            px='3'
            borderRadius='md'
            bg='transparent'
            color='fgMuted'
            fontWeight='600'
            borderBottom='2px solid'
            borderBottomColor='transparent'
            transition='all 0.18s ease'
            _before={{ display: 'none', content: 'none' }}
            _hover={{ color: 'white', bg: 'rgba(255,255,255,0.03)' }}
            _selected={{
              color: 'white',
              bg: 'rgba(255,255,255,0.04)',
              borderBottomColor: 'brandCyan',
            }}
            display={'flex'}
            justifyContent={'center'}
          >
            Chunk Status
          </Tabs.Trigger>
          <Tabs.Trigger
            value='logs'
            flex='1'
            py='2.5'
            px='3'
            borderRadius='md'
            bg='transparent'
            color='fgMuted'
            fontWeight='600'
            borderBottom='2px solid'
            borderBottomColor='transparent'
            transition='all 0.18s ease'
            _before={{ display: 'none', content: 'none' }}
            _hover={{ color: 'white', bg: 'rgba(255,255,255,0.03)' }}
            _selected={{
              color: 'white',
              bg: 'rgba(255,255,255,0.04)',
              borderBottomColor: 'brandCyan',
            }}
            display={'flex'}
            justifyContent={'center'}
          >
            Event Logs
          </Tabs.Trigger>
        </Tabs.List>

        <Box
          flex='1'
          minH='0'
          overflow='hidden'
          display='flex'
          flexDirection='column'
        >
          <Tabs.Content
            value='stages'
            flex='1'
            minH='0'
            display='flex'
            flexDirection='column'
            overflow='hidden'
          >
            <Box flex='1' minH='0' overflowY='auto' pr='1'>
              <Stack gap='2'>
                {job.stages.map((stage) => (
                  <Flex
                    key={stage.key}
                    justify='space-between'
                    align='start'
                    gap='3'
                    p='2'
                    borderRadius='md'
                    bg='rgba(8, 17, 33, 0.93)'
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
            </Box>
          </Tabs.Content>

          <Tabs.Content
            value='chunks'
            flex='1'
            minH='0'
            display='flex'
            flexDirection='column'
            overflow='hidden'
          >
            <Box flex='1' minH='0' overflowY='auto' pr='1'>
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
                          bg='rgba(127, 29, 29, 0.22)'
                        >
                          <Flex justify='space-between' align='center'>
                            <Box flex='1' minW='0'>
                              <Text
                                fontSize='sm'
                                color='red.200'
                                fontWeight='semibold'
                              >
                                Chunk {chunk.chunk_index + 1}
                              </Text>
                              <Text fontSize='xs' color='slate.300'>
                                {chunk.error_message ||
                                  'Chunk extraction failed.'}
                              </Text>
                              {chunk.attempt_count > 1 && (
                                <Text fontSize='xs' color='slate.500' mt='1'>
                                  Attempt {chunk.attempt_count}
                                </Text>
                              )}
                            </Box>
                            {onRetryChunk && (
                              <Button
                                size='xs'
                                variant='outline'
                                colorPalette='red'
                                ml='3'
                                flexShrink={0}
                                loading={retrying.has(chunk.chunk_id)}
                                onClick={() => void handleRetry(chunk.chunk_id)}
                              >
                                Retry
                              </Button>
                            )}
                          </Flex>
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
                          bg='rgba(8, 17, 33, 0.56)'
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
                  <Flex
                    align='center'
                    justify='center'
                    h='100px'
                    color='slate.500'
                  >
                    <Text fontSize='sm'>No chunk data available yet.</Text>
                  </Flex>
                )}
              </Stack>
            </Box>
          </Tabs.Content>

          <Tabs.Content
            value='logs'
            flex='1'
            minH='0'
            display='flex'
            flexDirection='column'
            overflow='hidden'
          >
            <Box flex='1' minH='0' overflowY='auto' pr='1'>
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
                      <Text
                        as='span'
                        color='brand.400'
                        mr='2'
                        fontWeight='bold'
                      >
                        [{entry.step}]
                      </Text>
                      <Text as='span' color='slate.300'>
                        {entry.message}
                      </Text>
                    </Box>
                  ))
                ) : (
                  <Flex
                    align='center'
                    justify='center'
                    h='100px'
                    color='slate.500'
                  >
                    <Text fontSize='sm'>Waiting for logs...</Text>
                  </Flex>
                )}
              </Stack>
            </Box>
          </Tabs.Content>
        </Box>
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
