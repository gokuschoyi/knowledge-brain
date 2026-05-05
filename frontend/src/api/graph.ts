import { apiFetch } from './client';
import type { GraphResponse } from './types';

export function getGraph() {
  return apiFetch<GraphResponse>('/graph/');
}
