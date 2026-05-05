import { apiFetch, API_BASE_URL } from './client';
import type { ChatResponse, ChatSession } from './types';

export type ChatStreamEvent =
  | { type: 'status'; message: string }
  | {
      type: 'context';
      payload: Pick<ChatResponse, 'confidence_score' | 'knowledge_gaps'>;
    }
  | { type: 'token'; delta: string }
  | { type: 'final'; payload: ChatResponse }
  | { type: 'error'; message: string };

export async function queryChatStreaming(
  question: string,
  sessionId: number | null,
  brainId: string | null,
  onUpdate: (event: ChatStreamEvent) => void,
) {
  const response = await fetch(`${API_BASE_URL}/chat/query/stream/`, {
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

  if (!response.ok) {
    throw new Error(`Streaming chat request failed: ${response.status}`);
  }
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      const lines = rawEvent.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.substring(6)) as ChatStreamEvent;
          onUpdate(data);
        } catch (e) {
          console.error('Error parsing SSE chunk', e);
        }
      }
    }
  }

  if (buffer.trim().startsWith('data: ')) {
    try {
      onUpdate(JSON.parse(buffer.trim().substring(6)) as ChatStreamEvent);
    } catch (e) {
      console.error('Error parsing trailing SSE chunk', e);
    }
  }
}

export function getChatSessions(brainId?: string) {
  const url = brainId
    ? `/chat/sessions/?brain_id=${brainId}`
    : '/chat/sessions/';
  return apiFetch<ChatSession[]>(url);
}

export function getChatSession(id: number) {
  return apiFetch<ChatSession>(`/chat/sessions/${id}/`);
}

export function queryChat(
  question: string,
  sessionId?: number | null,
  brainId?: string | null,
) {
  return apiFetch<ChatResponse>('/chat/query/', {
    method: 'POST',
    body: JSON.stringify({
      question,
      session_id: sessionId ?? null,
      brain_id: brainId ?? null,
    }),
  });
}
