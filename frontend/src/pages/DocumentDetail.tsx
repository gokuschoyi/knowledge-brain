import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Separator,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import {
  deleteDocument,
  getDocument,
  getDocumentChunks,
  getDocumentEntities,
  getDocumentRelationships,
  retryChunk,
  retryDocument,
} from '../api/documents';
import type { ChunkExtractionStatus } from '../api/types';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ConfirmDocumentDeleteDialog } from '../components/documents/ConfirmDocumentDeleteDialog';
import { LoadingState } from '../components/common/LoadingState';

const extractionStatusPalette: Record<ChunkExtractionStatus, string> = {
  pending: 'gray',
  queued: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [retryingChunks, setRetryingChunks] = useState<Set<number>>(new Set());

  const docQuery = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
  });
  const chunksQuery = useQuery({
    queryKey: ['document-chunks', id],
    queryFn: () => getDocumentChunks(id),
  });
  const entitiesQuery = useQuery({
    queryKey: ['document-entities', id],
    queryFn: () => getDocumentEntities(id),
  });
  const relationshipsQuery = useQuery({
    queryKey: ['document-relationships', id],
    queryFn: () => getDocumentRelationships(id),
  });

  const retryMutation = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setIsDeleteDialogOpen(false);
      navigate('/documents');
    },
  });

  const handleRetryChunk = async (chunkId: number) => {
    setRetryingChunks((prev) => new Set(prev).add(chunkId));
    try {
      await retryChunk(Number(id), chunkId);
      await queryClient.invalidateQueries({
        queryKey: ['document-chunks', id],
      });
    } finally {
      setRetryingChunks((prev) => {
        const next = new Set(prev);
        next.delete(chunkId);
        return next;
      });
    }
  };

  if (docQuery.isLoading || !docQuery.data) {
    return <LoadingState label='Loading document...' />;
  }

  const doc = docQuery.data;

  return (
    <Stack gap='6' align='stretch' h='full' minH='0' p={6}>
      <Card>
        <Flex align='flex-start' justify='space-between' gap='4'>
          <Box>
            <Heading size='lg' color='white'>
              {doc.title}
            </Heading>
            <HStack mt='2' gap='3' color='slate.500' fontSize='sm'>
              <Text>{doc.llm_provider}</Text>
              <Separator orientation='vertical' h='3' borderColor='slate.700' />
              <Text>{doc.llm_model}</Text>
              <Badge
                size='sm'
                colorPalette={
                  doc.status === 'completed'
                    ? 'green'
                    : doc.status === 'failed'
                      ? 'red'
                      : 'blue'
                }
              >
                {doc.status}
              </Badge>
            </HStack>
          </Box>
          <HStack gap='2'>
            {doc.status === 'failed' && (
              <Button
                disabled={retryMutation.isPending}
                onClick={() => void retryMutation.mutateAsync(id)}
              >
                {retryMutation.isPending ? 'Retrying...' : 'Retry'}
              </Button>
            )}
            <Button
              variant='outline'
              colorPalette='red'
              disabled={deleteMutation.isPending}
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </HStack>
        </Flex>

        <Box mt='4'>
          <Heading size='xs' color='slate.500' textTransform='uppercase' mb='2'>
            Summary
          </Heading>
          <Text color='slate.300' fontSize='sm' lineHeight='tall'>
            {doc.summary || 'No summary available.'}
          </Text>
        </Box>

        {doc.error_message && (
          <Box
            mt='4'
            p='3'
            bg='red.900/20'
            borderRadius='md'
            borderWidth='1px'
            borderColor='red.900/30'
          >
            <Text color='red.300' fontSize='sm'>
              {doc.error_message}
            </Text>
          </Box>
        )}
      </Card>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap='6' flex='1' minH='0'>
        <Card display='flex' flexDirection='column' minH='0'>
          <Heading size='sm' color='white' mb='4'>
            Chunks, {chunksQuery.data?.length ?? 0}
          </Heading>
          <Stack
            gap='3'
            align='stretch'
            flex='1'
            minH='0'
            overflowY='auto'
            pr='1'
          >
            {chunksQuery.data?.map((chunk) => {
              const isEmpty =
                chunk.extraction_status === 'completed' &&
                chunk.entity_count === 0 &&
                chunk.relationship_count === 0;
              const canRetry = chunk.extraction_status === 'failed' || isEmpty;
              return (
                <Box
                  key={chunk.id}
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
                        colorPalette={
                          extractionStatusPalette[chunk.extraction_status]
                        }
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
                            chunk.extraction_status === 'failed'
                              ? 'red'
                              : 'orange'
                          }
                          loading={retryingChunks.has(chunk.id)}
                          onClick={() => void handleRetryChunk(chunk.id)}
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
            })}
          </Stack>
        </Card>

        <Card display='flex' flexDirection='column' minH='0'>
          <Heading size='sm' color='white' mb='4'>
            Entities, {entitiesQuery.data?.length ?? 0}
          </Heading>
          <Stack
            gap='2'
            align='stretch'
            flex='1'
            minH='0'
            overflowY='auto'
            pr='1'
          >
            {entitiesQuery.data?.map((entity) => (
              <Flex
                key={entity.id}
                p='2'
                bg='slate.900/50'
                borderRadius='md'
                align='center'
                fontSize='sm'
                color='slate.300'
              >
                <Box w='2' h='2' borderRadius='full' bg='brand.400' mr='3' />
                {entity.name}
              </Flex>
            ))}
          </Stack>
        </Card>

        <Card display='flex' flexDirection='column' minH='0'>
          <Heading size='sm' color='white' mb='4'>
            Relationships, {relationshipsQuery.data?.length ?? 0}
          </Heading>
          <Stack
            gap='2'
            align='stretch'
            flex='1'
            minH='0'
            overflowY='auto'
            pr='1'
          >
            {relationshipsQuery.data?.map((relationship) => (
              <Box
                key={relationship.id}
                p='2'
                bg='slate.900/50'
                borderRadius='md'
                fontSize='sm'
                color='slate.300'
              >
                <HStack wrap='wrap'>
                  <Text fontWeight='bold' color='white'>
                    {relationship.source_name}
                  </Text>
                  <Badge size='sm' variant='outline' colorPalette='orange'>
                    {relationship.relationship_type}
                  </Badge>
                  <Text fontWeight='bold' color='white'>
                    {relationship.target_name}
                  </Text>
                </HStack>
              </Box>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <ConfirmDocumentDeleteDialog
        documentTitle={doc.title}
        isOpen={isDeleteDialogOpen}
        isDeleting={deleteMutation.isPending}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          void deleteMutation.mutateAsync(id);
        }}
      />
    </Stack>
  );
}
