import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Grid, Heading, Stack, Text, VStack } from '@chakra-ui/react';

import {
  getIngestionJob,
  ingestDocument,
  listDocuments,
  retryChunk,
} from '../api/documents';
import { getBrains } from '../api/brains';
import { getModelCatalog } from '../api/models';
import type { IngestionJob } from '../api/types';
import { DocumentList } from '../components/ingest/DocumentList';
import { IngestForm } from '../components/ingest/IngestForm';
import { IngestionProgress } from '../components/ingest/IngestionProgress';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';
import { useActiveBrain } from '../context/useActiveBrain';

export function IngestPage() {
  const { activeBrainId } = useActiveBrain();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<IngestionJob | null>(null);
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
  const ingestMutation = useMutation({
    mutationFn: ingestDocument,
    onSuccess: (data) => {
      setJobId(data.job_id);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  useEffect(() => {
    if (!jobId) return;
    const interval = window.setInterval(async () => {
      const nextJob = await getIngestionJob(jobId);
      setJob(nextJob);
      if (nextJob.status === 'completed' || nextJob.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        window.clearInterval(interval);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [jobId, queryClient, retryVersion]);

  const handleRetryChunk = async (chunkId: number) => {
    if (!job || !jobId) return;
    await retryChunk(job.document, chunkId);
    const updated = await getIngestionJob(jobId);
    setJob(updated);
    setRetryVersion((v) => v + 1);
  };

  const ingestionActive =
    ingestMutation.isPending ||
    job?.status === 'pending' ||
    job?.status === 'processing' ||
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
            onSubmit={async (payload) => {
              return ingestMutation.mutateAsync(payload);
            }}
            loading={ingestMutation.isPending}
            ingestionActive={ingestionActive}
            activeBrainId={activeBrain.id}
            collapsed={isFormCollapsed}
            onToggleCollapse={() =>
              setIsFormManuallyCollapsed((current) => !current)
            }
            modelCatalog={modelCatalogQuery.data}
          />
          <IngestionProgress
            job={job}
            onRetryChunk={handleRetryChunk}
            fillAvailableSpace={isFormCollapsed}
          />
        </Box>
      </VStack>
      <DocumentList documents={documentsQuery.data} />
    </Grid>
  );
}
