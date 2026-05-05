import { apiFetch } from './client';
import type { GraphResponse } from './types';

export function getGraph(brainId?: string) {
  const search = brainId ? `?brain_id=${encodeURIComponent(brainId)}` : '';
  return apiFetch<GraphResponse>(`/graph/${search}`);
}
