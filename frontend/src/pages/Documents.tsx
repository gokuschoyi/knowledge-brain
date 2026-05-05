import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { deleteDocument, listDocuments, retryDocument } from "../api/documents";
import { DocumentList } from "../components/ingest/DocumentList";
import { LoadingState } from "../components/common/LoadingState";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const retryMutation = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      navigate("/documents");
    },
  });

  if (isLoading || !data) return <LoadingState label="Loading documents..." />;

  const busyDocumentId = retryMutation.isPending
    ? Number(retryMutation.variables)
    : deleteMutation.isPending
      ? Number(deleteMutation.variables)
      : null;

  return (
    <DocumentList
      documents={data}
      onRetry={async (id) => {
        await retryMutation.mutateAsync(id);
      }}
      onDelete={async (id) => {
        await deleteMutation.mutateAsync(id);
      }}
      busyDocumentId={busyDocumentId}
    />
  );
}
