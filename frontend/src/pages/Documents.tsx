import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Flex, Stack, Text, VStack } from '@chakra-ui/react';

import { deleteDocument, listDocuments, retryDocument } from '../api/documents';
import { DocumentList } from '../components/ingest/DocumentList';
import { Card } from '../components/common/Card';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

export function DocumentsPage() {
  const { activeBrainId } = useActiveBrain();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const entityIdFilter = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('entity_id');
    return raw ? Number(raw) : null;
  }, [location.search]);
  const statusFilter = useMemo(
    () => new URLSearchParams(location.search).get('status'),
    [location.search],
  );
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['documents', activeBrainId, entityIdFilter],
    queryFn: () => listDocuments(activeBrainId || undefined, entityIdFilter),
  });
  const retryMutation = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setPendingDeleteDocument(null);
      navigate('/documents');
    },
  });

  const filteredDocuments = useMemo(() => {
    if (!data) return [];
    if (!statusFilter) return data;
    return data.filter((document) => document.status === statusFilter);
  }, [data, statusFilter]);

  if (isLoading || !data) return <LoadingState label='Loading documents...' />;

  if (!filteredDocuments.length) {
    return (
      <Box p={6}>
        <Card>
          <Stack gap='2'>
            <Text fontSize='sm' color='slate.300'>
              {activeBrainId
                ? 'No documents were found for the active brain.'
                : 'No documents have been ingested yet.'}
            </Text>
            <Text fontSize='sm' color='slate.500'>
              {activeBrainId
                ? 'Try switching the active brain in the header or ingest new material into this brain.'
                : 'Select a brain in the header to narrow the list, or ingest your first document.'}
            </Text>
          </Stack>
        </Card>
      </Box>
    );
  }

  const busyDocumentId = retryMutation.isPending
    ? Number(retryMutation.variables)
    : deleteMutation.isPending
      ? Number(deleteMutation.variables)
      : null;

  return (
    <VStack gap={6} align='stretch' h='full' minH='0' overflow='hidden' pl={6}>
      <Flex flex='1' minH='0' overflow='hidden'>
        <DocumentList
          documents={filteredDocuments}
          onRetry={async (id) => {
            await retryMutation.mutateAsync(id);
          }}
          onDelete={async (id) => {
            const document = data.find((item) => item.id === id);
            if (!document) return;
            setPendingDeleteDocument({ id, title: document.title });
          }}
          busyDocumentId={busyDocumentId}
        />
      </Flex>

      <ConfirmDialog
        title='Delete Document'
        description={
          <>
            Are you sure you want to delete{' '}
            <strong>{pendingDeleteDocument?.title ?? 'this document'}</strong>?
            This action cannot be undone.
          </>
        }
        confirmLabel='Delete document'
        isOpen={!!pendingDeleteDocument}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteDocument(null);
          }
        }}
        onConfirm={() => {
          if (!pendingDeleteDocument) return;
          void deleteMutation.mutateAsync(pendingDeleteDocument.id);
        }}
      />
    </VStack>
  );
}
