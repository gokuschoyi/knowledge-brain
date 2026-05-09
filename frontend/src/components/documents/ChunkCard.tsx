import { Badge, Box, Flex, Text } from '@chakra-ui/react';

import type { Chunk, ChunkExtractionStatus } from '../../api/types';
import { Button } from '../common/Button';

const extractionStatusPalette: Record<ChunkExtractionStatus, string> = {
  pending: 'gray',
  queued: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

type Props = {
  chunk: Chunk;
  isRetrying: boolean;
  onRetry: (chunkId: number) => void;
};

export function ChunkCard({ chunk, isRetrying, onRetry }: Props) {
  const isEmpty =
    chunk.extraction_status === 'completed' &&
    chunk.entity_count === 0 &&
    chunk.relationship_count === 0;
  const canRetry = chunk.extraction_status === 'failed' || isEmpty;

  return (
    <Box
      borderRadius='md'
      borderWidth='1px'
      borderColor={
        chunk.extraction_status === 'failed'
          ? 'red.900'
          : isEmpty
            ? 'orange.900'
            : 'slate.800'
      }
      p='3'
      fontSize='sm'
      color='slate.300'
      _hover={{ bg: 'slate.900' }}
    >
      <Flex justify='space-between' align='center' mb='2'>
        <Text fontSize='xs' color='slate.500'>
          #{chunk.chunk_index + 1}
        </Text>
        <Flex gap='2' align='center'>
          <Badge
            size='xs'
            colorPalette={extractionStatusPalette[chunk.extraction_status]}
            variant='subtle'
            textTransform='capitalize'
          >
            {chunk.extraction_status}
          </Badge>
          {canRetry && (
            <Button
              size='xs'
              variant='outline'
              colorPalette={
                chunk.extraction_status === 'failed' ? 'red' : 'orange'
              }
              loading={isRetrying}
              onClick={() => onRetry(chunk.id)}
            >
              Retry
            </Button>
          )}
        </Flex>
      </Flex>
      <Text fontSize='sm' lineClamp={3}>
        {chunk.summary}
      </Text>
      <Flex gap='3' mt='2'>
        <Text fontSize='xs' color='slate.500'>
          {chunk.entity_count} entities
        </Text>
        <Text fontSize='xs' color='slate.500'>
          {chunk.relationship_count} relationships
        </Text>
      </Flex>
    </Box>
  );
}
