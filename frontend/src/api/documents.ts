import { apiFetch } from './client';
import type {
  BatchJobResponse,
  Chunk,
  DocumentEntity,
  DocumentIngestResponse,
  DocumentRelationship,
  DocumentSummary,
  IngestionJob,
} from './types';

export type Document = DocumentSummary;
export type { IngestionJob };

export function listDocuments(brainId?: string, entityId?: number | null) {
  const params = new URLSearchParams();
  if (brainId) params.set('brain_id', brainId);
  if (entityId) params.set('entity_id', String(entityId));
  const search = params.size ? `?${params.toString()}` : '';
  return apiFetch<Document[]>(`/documents/${search}`);
}

export function getDocument(id: string | number) {
  return apiFetch<Document>(`/documents/${id}/`);
}

export function getDocumentChunks(id: string | number) {
  return apiFetch<Chunk[]>(`/documents/${id}/chunks/`);
}

export function getDocumentEntities(id: string | number) {
  return apiFetch<DocumentEntity[]>(`/documents/${id}/entities/`);
}

export function getDocumentRelationships(id: string | number) {
  return apiFetch<DocumentRelationship[]>(`/documents/${id}/relationships/`);
}

export async function ingestDocument(
  payload: FormData | Record<string, unknown>,
) {
  return apiFetch<DocumentIngestResponse>('/documents/ingest/', {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function getIngestionJob(id: number) {
  return apiFetch<IngestionJob>(`/ingestion/jobs/${id}/`);
}

export function getBatchIngestionJobs(ids: number[]) {
  return apiFetch<BatchJobResponse>(`/ingestion/jobs/batch/?ids=${ids.join(',')}`);
}

export function retryDocument(id: string | number) {
  return apiFetch<DocumentIngestResponse>(`/documents/${id}/retry/`, {
    method: 'POST',
  });
}

export function deleteDocument(id: string | number) {
  return apiFetch<void>(`/documents/${id}/delete/`, {
    method: 'DELETE',
  });
}

export function retryChunk(documentId: number, chunkId: number) {
  return apiFetch<{ artifact_id: number; status: string }>(
    `/documents/${documentId}/chunks/${chunkId}/retry/`,
    { method: 'POST' },
  );
}
