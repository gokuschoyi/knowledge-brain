import { Box, Flex, Heading, Stack, Badge } from '@chakra-ui/react';

import { Document } from '../../api/documents';
import { Card } from '../common/Card';
import { DocumentItem } from '../documents/DocumentItem';

export function DocumentList({
  documents,
  onRetry,
  onDelete,
  busyDocumentId,
  maxHeight,
}: {
  documents: Document[];
  onRetry?: (id: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  busyDocumentId?: number | null;
  maxHeight?: string | number;
}) {
  return (
    <Box
      pr={{ base: 0, xl: 6 }}
      py={6}
      h='full'
      w='full'
      minH='0'
      overflow='hidden'
      display='flex'
      flexDirection='column'
    >
      <Card
        variant='panel'
        display='flex'
        flexDirection='column'
        h='full'
        minH='0'
        flex='1'
        px={0}
        overflow='hidden'
      >
        <Flex
          mb='2'
          align='center'
          justify='space-between'
          px={6}
          flexShrink='0'
        >
          <Heading size='sm' color='white'>
            All Documents
          </Heading>
          <Badge size='sm' variant='subtle' colorPalette='cyan'>
            {documents.length} total
          </Badge>
        </Flex>
        <Stack
          gap='3'
          align='stretch'
          flex='1'
          minH='0'
          maxH={maxHeight}
          overflowY='auto'
          overscrollBehavior='contain'
          px={6}
          pt={2}
        >
          {documents.map((document) => (
            <DocumentItem
              key={document.id}
              document={document}
              onRetry={
                onRetry
                  ? () => {
                      void onRetry(document.id);
                    }
                  : undefined
              }
              onDelete={
                onDelete
                  ? () => {
                      void onDelete(document.id);
                    }
                  : undefined
              }
              busy={busyDocumentId === document.id}
            />
          ))}
        </Stack>
      </Card>
    </Box>
  );
}
