import { apiFetch } from "./client";

export type ChatResponse = {
  session_id: number;
  answer: string;
  confidence_score: number;
  llm_provider?: string;
  llm_model?: string;
  sources: { document_id: number; document_title: string; chunk_id: number; snippet: string }[];
  related_entities: { id: number; name: string; type: string }[];
  knowledge_gaps: string[];
  self_healing_task_created: boolean;
};

export function queryChat(
  question: string,
  sessionId?: number | null,
  llmProvider?: string,
  llmModel?: string,
) {
  return apiFetch<ChatResponse>("/chat/query/", {
    method: "POST",
    body: JSON.stringify({
      question,
      session_id: sessionId ?? null,
      llm_provider: llmProvider ?? null,
      llm_model: llmModel ?? null,
    }),
  });
}
