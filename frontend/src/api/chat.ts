import { apiFetch, API_BASE_URL } from './client';

export type ChatResponse = {
  session_id: number;
  answer: string;
  confidence_score: number;
  llm_provider?: string;
  llm_model?: string;
  sources: {
    document_id: number;
    document_title: string;
    chunk_id: number;
    snippet: string;
  }[];
  related_entities: { id: number; name: string; type: string }[];
  knowledge_gaps: string[];
  self_healing_task_created: boolean;
};

export async function queryChatStreaming(
  question: string,
  sessionId: number | null,
  brainId: string | null,
  onUpdate: (type: string, data: any) => void,
) {
  const response = await fetch(`${API_BASE_URL}/chat/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      session_id: sessionId ?? null,
      brain_id: brainId,
    }),
  });

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          onUpdate(data.type, data.payload || data.node);
        } catch (e) {
          console.error('Error parsing SSE chunk', e);
        }
      }
    }
  }
}

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  messages: ChatMessage[];
};

export function getChatSessions(brainId?: string) {
  const url = brainId
    ? `/chat/sessions/?brain_id=${brainId}`
    : '/chat/sessions/';
  return apiFetch<ChatSession[]>(url);
}

export function getChatSession(id: number) {
  return apiFetch<ChatSession>(`/chat/sessions/${id}/`);
}

export function queryChat(question: string, sessionId?: number | null) {
  return apiFetch<ChatResponse>('/chat/query/', {
    method: 'POST',
    body: JSON.stringify({
      question,
      session_id: sessionId ?? null,
    }),
  });
}
