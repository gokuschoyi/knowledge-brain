import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import type { ChatSource } from '../../api/types';
import { Card } from '../common/Card';
import { MetaChip } from '../common/MetaChip';

export function SourcePanel({ sources }: { sources: ChatSource[] }) {
  return (
    <Card variant='panel' shadow='none'>
      <Heading size='sm' color='white' mb={3}>
        Intelligence Sources
      </Heading>
      <VStack gap={3} align='stretch'>
        {sources.map((source) => (
          <Box
            key={source.chunk_id}
            className='arctic-glass'
            borderRadius='xl'
            border='1px'
            borderColor='glassBorder'
            p={3}
          >
            <Text fontSize='sm' fontWeight='medium' color='white'>
              {source.document_title}
            </Text>
            <MetaChip mt='2' label='chunk' value={String(source.chunk_id)} />
            <Text mt={2} fontSize='sm' color='slate.300' lineClamp={4}>
              {source.snippet}
            </Text>
          </Box>
        ))}
      </VStack>
    </Card>
  );
}
