import { apiFetch } from './client';
import type { EvidenceSpan, EvidenceSpanRenderContext } from './types';

export function getEvidenceSpan(id: number) {
  return apiFetch<EvidenceSpan>(`/evidence-spans/${id}/`);
}

export function getEvidenceSpanRenderContext(id: number) {
  return apiFetch<EvidenceSpanRenderContext>(
    `/evidence-spans/${id}/render-context/`,
  );
}
