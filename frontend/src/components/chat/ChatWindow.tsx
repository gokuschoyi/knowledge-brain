import { FormEvent, useState } from "react";

import { ChatResponse } from "../../api/chat";
import { ModelCatalog } from "../../api/models";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow({
  response,
  onSubmit,
  loading,
  modelCatalog,
}: {
  response: ChatResponse | null;
  onSubmit: (question: string, llmProvider: string, llmModel: string) => Promise<void>;
  loading: boolean;
  modelCatalog: ModelCatalog;
}) {
  const [question, setQuestion] = useState("What is Smart Tutor and how does it relate to lesson plans?");
  const [llmProvider, setLlmProvider] = useState(modelCatalog.default_provider);
  const [llmModel, setLlmModel] = useState(modelCatalog.default_model);
  const providerOptions = modelCatalog.providers;
  const modelsForProvider = providerOptions[llmProvider]?.models || [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(question, llmProvider, llmModel);
  }

  return (
    <Card>
      <form className="mb-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Answer provider</label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={llmProvider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                setLlmProvider(nextProvider);
                const nextModel = modelCatalog.providers[nextProvider]?.models.find((model) => model.recommended)?.id
                  || modelCatalog.providers[nextProvider]?.models[0]?.id
                  || "";
                setLlmModel(nextModel);
              }}
            >
              {Object.entries(providerOptions).map(([providerKey, provider]) => (
                <option key={providerKey} value={providerKey}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Answer model</label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={llmModel}
              onChange={(event) => setLlmModel(event.target.value)}
            >
              {modelsForProvider.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400">
          Retrieval uses the shared embedding provider. This selector controls the model that synthesizes the answer.
        </div>
        <div className="flex gap-3">
          <input className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <Button disabled={loading} type="submit">
            {loading ? "Thinking..." : "Ask"}
          </Button>
        </div>
      </form>
      <div className="space-y-3">
        <MessageBubble role="user" content={question} />
        {response ? (
          <>
            <div className="flex items-center gap-2">
              <ConfidenceBadge score={response.confidence_score} />
              {response.llm_provider && response.llm_model ? (
                <div className="text-xs text-slate-500">
                  {response.llm_provider} · {response.llm_model}
                </div>
              ) : null}
            </div>
            <MessageBubble role="assistant" content={response.answer} />
          </>
        ) : null}
      </div>
    </Card>
  );
}
