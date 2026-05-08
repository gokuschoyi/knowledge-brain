import { apiFetch } from './client';
import type { PartitionedGraphResponse } from './types';

export function getGraph(brainId?: string) {
  const search = brainId ? `?brain_id=${encodeURIComponent(brainId)}` : '';
  return apiFetch<PartitionedGraphResponse>(`/graph/${search}`);
}
