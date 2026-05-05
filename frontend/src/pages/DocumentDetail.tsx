import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteDocument,
  getDocument,
  getDocumentChunks,
  getDocumentEntities,
  getDocumentRelationships,
  retryDocument,
} from "../api/documents";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { LoadingState } from "../components/common/LoadingState";

export function DocumentDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const docQuery = useQuery({ queryKey: ["document", id], queryFn: () => getDocument(id) });
  const chunksQuery = useQuery({ queryKey: ["document-chunks", id], queryFn: () => getDocumentChunks(id) });
  const entitiesQuery = useQuery({ queryKey: ["document-entities", id], queryFn: () => getDocumentEntities(id) });
  const relationshipsQuery = useQuery({ queryKey: ["document-relationships", id], queryFn: () => getDocumentRelationships(id) });
  const retryMutation = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      navigate("/documents");
    },
  });

  if (docQuery.isLoading || !docQuery.data) return <LoadingState label="Loading document..." />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{docQuery.data.title}</h2>
            <div className="mt-2 text-xs text-slate-500">
              {docQuery.data.llm_provider} · {docQuery.data.llm_model}
            </div>
          </div>
          <div className="flex gap-2">
            {docQuery.data.status === "failed" ? (
              <Button disabled={retryMutation.isPending} onClick={() => void retryMutation.mutateAsync(id)}>
                {retryMutation.isPending ? "Retrying..." : "Retry"}
              </Button>
            ) : null}
            <Button
              className="bg-slate-700 text-white hover:bg-slate-600"
              disabled={deleteMutation.isPending}
              onClick={() => void deleteMutation.mutateAsync(id)}
            >
              Delete
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">{docQuery.data.summary}</p>
        {docQuery.data.error_message ? (
          <div className="mt-3 text-sm text-rose-300">{docQuery.data.error_message}</div>
        ) : null}
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">Chunks</h3>
          <div className="space-y-3 text-sm text-slate-300">
            {chunksQuery.data?.map((chunk) => (
              <div key={chunk.id} className="rounded-md border border-slate-800 p-3">
                {chunk.summary}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">Entities</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {entitiesQuery.data?.map((entity) => (
              <div key={entity.id}>{entity.name}</div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">Relationships</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {relationshipsQuery.data?.map((relationship) => (
              <div key={relationship.id}>
                {relationship.source_name} {relationship.relationship_type} {relationship.target_name}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
