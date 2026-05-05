import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Flex,
  Heading,
  Text,
  Stack,
  Badge,
  Link as ChakraLink,
  HStack,
  Separator,
} from '@chakra-ui/react';

import { Document } from '../../api/documents';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

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
    <Box pr={6} py={6} h='full' minH='0' display='flex' flexDirection='column'>
      <Card display='flex' flexDirection='column' h='full' minH='0' flex='1'>
        <Flex mb='4' align='center' justify='space-between'>
          <Heading size='sm' color='white'>
            Recent documents
          </Heading>
          <Badge size='sm' variant='subtle' colorPalette='slate'>
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
          pr='1'
        >
          {documents.map((document) => (
            <Box
              key={document.id}
              borderRadius='md'
              borderWidth='1px'
              borderColor='slate.800'
              px='4'
              py='4'
              _hover={{ bg: 'slate.950' }}
              transition='background 0.2s'
            >
              <Flex align='flex-start' justify='space-between' gap='3'>
                <ChakraLink
                  asChild
                  flex='1'
                  _hover={{ textDecoration: 'none' }}
                >
                  <RouterLink to={`/documents/${document.id}`}>
                    <Text fontWeight='medium' color='white'>
                      {document.title}
                    </Text>
                  </RouterLink>
                </ChakraLink>
                <Badge
                  size='sm'
                  colorPalette={
                    document.status === 'completed'
                      ? 'green'
                      : document.status === 'failed'
                        ? 'red'
                        : 'blue'
                  }
                >
                  {document.status}
                </Badge>
              </Flex>

              <HStack mt='2' gap='3' fontSize='xs' color='slate.500'>
                <Text>{document.llm_provider || 'provider?'}</Text>
                <Separator
                  orientation='vertical'
                  h='3'
                  borderColor='slate.700'
                />
                <Text>{document.llm_model || 'model?'}</Text>
              </HStack>

              <ChakraLink
                asChild
                display='block'
                mt='2'
                _hover={{ textDecoration: 'none' }}
              >
                <RouterLink to={`/documents/${document.id}`}>
                  <Text fontSize='sm' color='slate.400' lineClamp={2}>
                    {document.summary || 'No summary yet.'}
                  </Text>
                </RouterLink>
              </ChakraLink>

              {document.error_message && (
                <Text mt='2' fontSize='sm' color='red.300'>
                  {document.error_message}
                </Text>
              )}

              {(document.status === 'failed' || onDelete) && (
                <HStack mt='4' gap='2'>
                  {document.status === 'failed' && onRetry && (
                    <Button
                      size='sm'
                      disabled={busyDocumentId === document.id}
                      onClick={() => void onRetry(document.id)}
                    >
                      {busyDocumentId === document.id ? 'Retrying...' : 'Retry'}
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size='sm'
                      variant='outline'
                      colorPalette='red'
                      disabled={busyDocumentId === document.id}
                      onClick={() => void onDelete(document.id)}
                    >
                      Delete
                    </Button>
                  )}
                </HStack>
              )}
            </Box>
          ))}
        </Stack>
      </Card>
    </Box>
  );
}
