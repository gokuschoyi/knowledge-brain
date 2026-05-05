import { apiFetch } from './client';

export type DashboardMetrics = {
  documents: number;
  chunks: number;
  entities: number;
  relationships: number;
  open_self_healing_tasks: number;
  average_quality_score: number;
};

export function getDashboard(brainId?: string) {
  const search = brainId ? `?brain_id=${encodeURIComponent(brainId)}` : '';
  return apiFetch<DashboardMetrics>(`/dashboard/${search}`);
}
