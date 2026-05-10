import { apiFetch } from './client';
import type {
  SelfHealingAttachEvidenceResponse,
  SelfHealingRunAllResponse,
  SelfHealingRunResponse,
  SelfHealingTask,
} from './types';

export function listSelfHealingTasks(
  brainId?: string,
  options?: { taskType?: string | null; relatedEntityId?: number | null },
) {
  const params = new URLSearchParams();
  if (brainId) params.set('brain_id', brainId);
  if (options?.taskType) params.set('task_type', options.taskType);
  if (options?.relatedEntityId) {
    params.set('related_entity_id', String(options.relatedEntityId));
  }
  const url = params.size
    ? `/self-healing/tasks/?${params.toString()}`
    : '/self-healing/tasks/';
  return apiFetch<SelfHealingTask[]>(url);
}

export function runSelfHealingTask(id: number) {
  return apiFetch<SelfHealingRunResponse>(`/self-healing/tasks/${id}/run/`, {
    method: 'POST',
  });
}

export function attachSelfHealingEvidence(
  id: number,
  payload: FormData | Record<string, unknown>,
) {
  return apiFetch<SelfHealingAttachEvidenceResponse>(
    `/self-healing/tasks/${id}/evidence/`,
    {
      method: 'POST',
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    },
  );
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
