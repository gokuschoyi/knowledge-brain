import { apiFetch } from './client';

export type Brain = {
  id: string;
  name: string;
  description: string;
  auto_repair_enabled: boolean;
  auto_repair_safe_only: boolean;
  auto_repair_allowed_types: string[];
  auto_repair_frequency_minutes: number;
  last_auto_repair_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getBrains() {
  return apiFetch<Brain[]>('/dashboard/brains/');
}

export function createBrain(name: string, description: string) {
  return apiFetch<Brain>('/dashboard/brains/', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function updateBrain(
  id: string,
  payload: Partial<
    Pick<
      Brain,
      | 'name'
      | 'description'
      | 'auto_repair_enabled'
      | 'auto_repair_safe_only'
      | 'auto_repair_allowed_types'
      | 'auto_repair_frequency_minutes'
    >
  >,
) {
  return apiFetch<Brain>(`/dashboard/brains/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteBrain(id: string) {
  return apiFetch<void>(`/dashboard/brains/${id}/`, {
    method: 'DELETE',
  });
}
