import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getIngestionJob, ingestDocument, listDocuments, type IngestionJob } from "../api/documents";
import { getModelCatalog } from "../api/models";
import { DocumentList } from "../components/ingest/DocumentList";
import { IngestForm } from "../components/ingest/IngestForm";
import { IngestionProgress } from "../components/ingest/IngestionProgress";
import { LoadingState } from "../components/common/LoadingState";

export function IngestPage() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const modelCatalogQuery = useQuery({ queryKey: ["model-catalog"], queryFn: getModelCatalog });
  const ingestMutation = useMutation({
    mutationFn: ingestDocument,
    onSuccess: (data) => {
      setJobId(data.job_id);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  useEffect(() => {
    if (!jobId) return;
    const interval = window.setInterval(async () => {
      const nextJob = await getIngestionJob(jobId);
      setJob(nextJob);
      if (nextJob.status === "completed" || nextJob.status === "failed") {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        window.clearInterval(interval);
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [jobId, queryClient]);

  if (documentsQuery.isLoading || modelCatalogQuery.isLoading || !documentsQuery.data || !modelCatalogQuery.data) {
    return <LoadingState label="Loading ingestion workspace..." />;
  }

  const ingestionActive =
    ingestMutation.isPending
    || job?.status === "pending"
    || job?.status === "processing"
    || documentsQuery.data.some((document) => document.status === "pending" || document.status === "processing");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
        <IngestForm
          onSubmit={async (payload) => {
            await ingestMutation.mutateAsync(payload);
          }}
          loading={ingestMutation.isPending}
          ingestionActive={ingestionActive}
          modelCatalog={modelCatalogQuery.data}
        />
        <IngestionProgress job={job} />
      </div>
      <DocumentList documents={documentsQuery.data} />
    </div>
  );
}
