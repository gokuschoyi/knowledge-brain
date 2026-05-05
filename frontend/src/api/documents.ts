import { apiFetch } from "./client";

export type Document = {
  id: number;
  title: string;
  source_type: string;
  tags: string[];
  llm_provider: string;
  llm_model: string;
  status: string;
  summary: string;
  quality_score: number;
  error_message: string;
  created_at: string;
  updated_at: string;
  chunks_count: number;
};

export type IngestionJob = {
  id: number;
  document: number;
  status: string;
  current_step: string;
  progress: number;
  log: { step: string; message: string }[];
  error_message: string;
};

export function listDocuments() {
  return apiFetch<Document[]>("/documents/");
}

export function getDocument(id: string | number) {
  return apiFetch<Document>(`/documents/${id}/`);
}

export function getDocumentChunks(id: string | number) {
  return apiFetch<any[]>(`/documents/${id}/chunks/`);
}

export function getDocumentEntities(id: string | number) {
  return apiFetch<any[]>(`/documents/${id}/entities/`);
}

export function getDocumentRelationships(id: string | number) {
  return apiFetch<any[]>(`/documents/${id}/relationships/`);
}

export async function ingestDocument(payload: FormData | Record<string, unknown>) {
  return apiFetch<{ document_id: number; job_id: number; status: string }>("/documents/ingest/", {
    method: "POST",
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function getIngestionJob(id: number) {
  return apiFetch<IngestionJob>(`/ingestion/jobs/${id}/`);
}

export function retryDocument(id: string | number) {
  return apiFetch<{ document_id: number; job_id: number; status: string }>(`/documents/${id}/retry/`, {
    method: "POST",
  });
}

export function deleteDocument(id: string | number) {
  return apiFetch<void>(`/documents/${id}/delete/`, {
    method: "DELETE",
  });
}
