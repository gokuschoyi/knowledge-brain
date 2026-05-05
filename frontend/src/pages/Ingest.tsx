import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid, VStack } from '@chakra-ui/react';

import {
  getIngestionJob,
  ingestDocument,
  listDocuments,
} from '../api/documents';
import { getBrains } from '../api/brains';
import { getModelCatalog } from '../api/models';
import type { IngestionJob } from '../api/types';
import { DocumentList } from '../components/ingest/DocumentList';
import { IngestForm } from '../components/ingest/IngestForm';
import { IngestionProgress } from '../components/ingest/IngestionProgress';
import { LoadingState } from '../components/common/LoadingState';

export function IngestPage() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: listDocuments,
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
    }, 1500);
    return () => window.clearInterval(interval);
  }, [jobId, queryClient]);

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

  const ingestionActive =
    ingestMutation.isPending ||
    job?.status === 'pending' ||
    job?.status === 'processing' ||
    documentsQuery.data.some(
      (document) =>
        document.status === 'pending' || document.status === 'processing',
    );

  return (
    <Grid templateColumns={{ base: '1fr', xl: '0.95fr 1.05fr' }} gap={6}>
      <VStack gap={6} align='stretch'>
        <IngestForm
          onSubmit={async (payload) => {
            return ingestMutation.mutateAsync(payload);
          }}
          loading={ingestMutation.isPending}
          ingestionActive={ingestionActive}
          modelCatalog={modelCatalogQuery.data}
          brains={brainsQuery.data}
        />
        <IngestionProgress job={job} />
      </VStack>
      <DocumentList documents={documentsQuery.data} />
    </Grid>
  );
}
