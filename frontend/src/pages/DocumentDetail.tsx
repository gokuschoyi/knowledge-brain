import {
  Box,
  Flex,
  Heading,
  HStack,
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
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { MetaChip } from '../components/common/MetaChip';
import { LoadingState } from '../components/common/LoadingState';
import { ChunkCard } from '../components/documents/ChunkCard';
import { EntityListItem } from '../components/documents/EntityListItem';
import { RelationshipItem } from '../components/documents/RelationshipItem';

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
      <Card variant='hero'>
        <Flex align='flex-start' justify='space-between' gap='4'>
          <Box>
            <Heading size='lg' color='white'>
              {doc.title}
            </Heading>
            <HStack mt='3' gap='2' wrap='wrap'>
              <MetaChip
                label='provider'
                value={doc.llm_provider || 'unknown'}
              />
              <MetaChip label='model' value={doc.llm_model || 'unknown'} />
              <MetaChip label='status' value={doc.status} />
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
        <Card variant='panel' display='flex' flexDirection='column' minH='0'>
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
            {chunksQuery.data?.map((chunk) => (
              <ChunkCard
                key={chunk.id}
                chunk={chunk}
                isRetrying={retryingChunks.has(chunk.id)}
                onRetry={(chunkId) => void handleRetryChunk(chunkId)}
              />
            ))}
          </Stack>
        </Card>

        <Card variant='panel' display='flex' flexDirection='column' minH='0'>
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
              <EntityListItem key={entity.id} entity={entity} />
            ))}
          </Stack>
        </Card>

        <Card variant='panel' display='flex' flexDirection='column' minH='0'>
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
              <RelationshipItem
                key={relationship.id}
                relationship={relationship}
              />
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <ConfirmDialog
        title='Delete Document'
        description={
          <>
            Are you sure you want to delete <strong>{doc.title}</strong>? This
            action cannot be undone.
          </>
        }
        confirmLabel='Delete document'
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
