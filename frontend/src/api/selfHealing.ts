import { apiFetch } from "./client";

export function listSelfHealingTasks() {
  return apiFetch<any[]>("/self-healing/tasks/");
}

export function runSelfHealingTask(id: number) {
  return apiFetch(`/self-healing/tasks/${id}/run/`, { method: "POST" });
}

export function ignoreSelfHealingTask(id: number) {
  return apiFetch(`/self-healing/tasks/${id}/ignore/`, { method: "POST" });
}

