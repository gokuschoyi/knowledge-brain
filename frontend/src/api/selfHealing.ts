import { apiFetch } from './client';
import type {
  SelfHealingRunAllResponse,
  SelfHealingRunResponse,
  SelfHealingTask,
} from './types';

export function listSelfHealingTasks() {
  return apiFetch<SelfHealingTask[]>('/self-healing/tasks/');
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

export function runAllSelfHealingTasks() {
  return apiFetch<SelfHealingRunAllResponse>('/self-healing/run-all/', {
    method: 'POST',
  });
}
