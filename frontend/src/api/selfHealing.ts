import { apiFetch } from './client';
import type {
  SelfHealingRunAllResponse,
  SelfHealingRunResponse,
  SelfHealingTask,
} from './types';

export function listSelfHealingTasks(brainId?: string) {
  const url = brainId
    ? `/self-healing/tasks/?brain_id=${brainId}`
    : '/self-healing/tasks/';
  return apiFetch<SelfHealingTask[]>(url);
}

export function runSelfHealingTask(id: number) {
  return apiFetch<SelfHealingRunResponse>(`/self-healing/tasks/${id}/run/`, {
    method: 'POST',
  });
}

export function ignoreSelfHealingTask(id: number) {
  return apiFetch<SelfHealingTask>(`/self-healing/tasks/${id}/ignore/`, {
    method: 'POST',
  });
}

export function deleteSelfHealingTask(id: number) {
  return apiFetch<void>(`/self-healing/tasks/${id}/`, {
    method: 'DELETE',
  });
}

export function runAllSelfHealingTasks(brainId?: string | null) {
  return apiFetch<SelfHealingRunAllResponse>('/self-healing/run/', {
    method: 'POST',
    body: JSON.stringify({
      brain_id: brainId ?? null,
    }),
  });
}
