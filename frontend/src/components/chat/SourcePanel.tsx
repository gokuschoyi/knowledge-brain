import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import type { ChatSource } from '../../api/types';
import { Card } from '../common/Card';

export function SourcePanel({ sources }: { sources: ChatSource[] }) {
  return (
    <Card shadow='none'>
      <Heading size='sm' color='white' mb={3}>
        Sources
      </Heading>
      <VStack gap={3} align='stretch'>
        {sources.map((source) => (
          <Box
            key={source.chunk_id}
            borderRadius='md'
            border='1px'
            borderColor='slate.800'
            p={3}
            bg='slate.950'
          >
            <Text fontSize='sm' fontWeight='medium' color='white'>
              {source.document_title}
            </Text>
            <Text fontSize='xs' color='slate.500'>
              Chunk {source.chunk_id}
            </Text>
            <Text mt={2} fontSize='sm' color='slate.300' lineClamp={4}>
              {source.snippet}
            </Text>
          </Box>
        ))}
      </VStack>
    </Card>
  );
}
