import { apiFetch } from './client';

export type DashboardMetrics = {
  documents: number;
  chunks: number;
  entities: number;
  relationships: number;
  open_self_healing_tasks: number;
  unresolved_contradictions: number;
  unresolved_low_confidence: number;
  isolated_entities: number;
  reviewed_claims: number;
  trust_score_percent: number;
  claim_review_coverage_percent: number;
  contradiction_health_percent: number;
  authority_coverage_percent: number;
  freshness_coverage_percent: number;
  average_quality_score: number;
  quality_score_percent: number;
  hero: {
    status: string;
    title: string;
    description: string;
    documents_completed: number;
    documents_failed: number;
    documents_processing: number;
  };
  brain_summary: {
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    auto_repair_enabled: boolean;
    auto_repair_safe_only: boolean;
    auto_repair_allowed_types: string[];
    auto_repair_frequency_minutes: number;
    last_auto_repair_at: string | null;
  } | null;
  analytics: Array<{
    label: string;
    value: number;
    tone?: 'indigo' | 'cyan' | 'warning';
  }>;
  recommended_actions: Array<{
    label: string;
    count: number;
    href: string;
  }>;
};

export function getDashboard(brainId?: string) {
  const search = brainId ? `?brain_id=${encodeURIComponent(brainId)}` : '';
  return apiFetch<DashboardMetrics>(`/dashboard/${search}`);
}
