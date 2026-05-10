import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Grid, Heading, Stack, Text, VStack } from '@chakra-ui/react';

import {
  getBatchIngestionJobs,
  ingestDocument,
  listDocuments,
  retryChunk,
} from '../api/documents';
import { getBrains } from '../api/brains';
import { getModelCatalog } from '../api/models';
import type { BatchJobResponse } from '../api/types';
import { DocumentList } from '../components/ingest/DocumentList';
import { IngestForm } from '../components/ingest/IngestForm';
import { BatchIngestionProgress } from '../components/ingest/BatchIngestionProgress';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

export function IngestPage() {
  const { activeBrainId } = useActiveBrain();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobIds, setJobIds] = useState<number[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchJobResponse | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [isFormManuallyCollapsed, setIsFormManuallyCollapsed] = useState(false);

  const documentsQuery = useQuery({
    queryKey: ['documents', activeBrainId],
    queryFn: () => listDocuments(activeBrainId || undefined),
  });
  const brainsQuery = useQuery({ queryKey: ['brains'], queryFn: getBrains });
  const modelCatalogQuery = useQuery({
    queryKey: ['model-catalog'],
    queryFn: getModelCatalog,
  });

  useEffect(() => {
    if (!jobIds.length) return;
    const interval = window.setInterval(async () => {
      const batch = await getBatchIngestionJobs(jobIds);
      setBatchStatus(batch);
      if (batch.summary.all_terminal) {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        window.clearInterval(interval);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [jobIds, queryClient, retryVersion]);

  const handleSubmit = async (formDataList: FormData[]) => {
    setIsSubmitting(true);
    setBatchStatus(null);
    try {
      const results = await Promise.all(formDataList.map((fd) => ingestDocument(fd)));
      const ids = results.map((r) => r.job_id);
      setJobIds(ids);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryChunk = async (documentId: number, chunkId: number) => {
    await retryChunk(documentId, chunkId);
    if (jobIds.length) {
      const batch = await getBatchIngestionJobs(jobIds);
      setBatchStatus(batch);
      setRetryVersion((v) => v + 1);
    }
  };

  const ingestionActive =
    isSubmitting ||
    (batchStatus !== null && !batchStatus.summary.all_terminal) ||
    (documentsQuery.data?.some(
      (document) =>
        document.status === 'pending' || document.status === 'processing',
    ) ??
      false);
  const isFormCollapsed = ingestionActive || isFormManuallyCollapsed;

  if (
    documentsQuery.isLoading ||
    modelCatalogQuery.isLoading ||
    brainsQuery.isLoading ||
    !documentsQuery.data ||
    !modelCatalogQuery.data ||
    !brainsQuery.data
  ) {
    return <LoadingState label='Loading ingestion workspace...' />;
  }

  const activeBrain =
    brainsQuery.data.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Box p={6}>
        <Card>
          <Stack gap='3'>
            <Heading size='sm' color='white'>
              Select an active brain
            </Heading>
            <Text fontSize='sm' color='slate.400'>
              Choose a brain from the header before ingesting documents. The
              active brain controls where new knowledge is stored.
            </Text>
          </Stack>
        </Card>
      </Box>
    );
  }

  return (
    <Grid
      templateColumns={{ base: '1fr', xl: '0.95fr 1.05fr' }}
      gap={6}
      h='full'
      minH='0'
      className='ingestion-page'
    >
      <VStack gap={6} align='stretch' minH='0' py={6} pl={6}>
        <Box
          flex='1'
          minH='0'
          overflowY='auto'
          overflowX='hidden'
          display='flex'
          flexDirection='column'
          gap={6}
        >
          <IngestForm
            onSubmit={handleSubmit}
            loading={isSubmitting}
            ingestionActive={ingestionActive}
            activeBrainId={activeBrain.id}
            collapsed={isFormCollapsed}
            onToggleCollapse={() =>
              setIsFormManuallyCollapsed((current) => !current)
            }
            modelCatalog={modelCatalogQuery.data}
          />
          <BatchIngestionProgress
            batchStatus={batchStatus}
            onRetryChunk={handleRetryChunk}
            fillAvailableSpace={isFormCollapsed}
          />
        </Box>
      </VStack>
      <DocumentList documents={documentsQuery.data} />
    </Grid>
  );
}
