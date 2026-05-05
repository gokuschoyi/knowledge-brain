import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryChat, type ChatResponse } from "../api/chat";
import { getModelCatalog } from "../api/models";
import { ChatWindow } from "../components/chat/ChatWindow";
import { KnowledgeGapPanel } from "../components/chat/KnowledgeGapPanel";
import { SourcePanel } from "../components/chat/SourcePanel";
import { LoadingState } from "../components/common/LoadingState";

export function ChatPage() {
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const modelCatalogQuery = useQuery({ queryKey: ["model-catalog"], queryFn: getModelCatalog });

  async function handleSubmit(question: string, llmProvider: string, llmModel: string) {
    setLoading(true);
    try {
      const nextResponse = await queryChat(question, sessionId, llmProvider, llmModel);
      setSessionId(nextResponse.session_id);
      setResponse(nextResponse);
    } finally {
      setLoading(false);
    }
  }

  if (modelCatalogQuery.isLoading || !modelCatalogQuery.data) {
    return <LoadingState label="Loading chat workspace..." />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <ChatWindow
        response={response}
        onSubmit={handleSubmit}
        loading={loading}
        modelCatalog={modelCatalogQuery.data}
      />
      <div className="space-y-6">
        <SourcePanel sources={response?.sources || []} />
        <KnowledgeGapPanel gaps={response?.knowledge_gaps || []} />
      </div>
    </div>
  );
}
