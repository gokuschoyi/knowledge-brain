import { apiFetch } from './client';

export type Brain = {
  id: string;
  name: string;
  description: string;
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

export function updateBrain(id: string, name: string, description: string) {
  return apiFetch<Brain>(`/dashboard/brains/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteBrain(id: string) {
  return apiFetch<void>(`/dashboard/brains/${id}/`, {
    method: 'DELETE',
  });
}
