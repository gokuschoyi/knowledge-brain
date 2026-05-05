import { apiFetch } from './client';

export function getGraph() {
  return apiFetch<{ nodes: any[]; edges: any[] }>('/graph/');
}
