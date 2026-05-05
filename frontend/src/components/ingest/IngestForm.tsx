import { FormEvent, useMemo, useRef, useState } from "react";

import { ModelCatalog } from "../../api/models";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

export function IngestForm({
  onSubmit,
  loading,
  ingestionActive,
  modelCatalog,
}: {
  onSubmit: (payload: FormData | Record<string, unknown>) => Promise<void>;
  loading: boolean;
  ingestionActive: boolean;
  modelCatalog: ModelCatalog;
}) {
  const defaultProvider = modelCatalog.default_provider;
  const defaultModel = modelCatalog.default_model;
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("text");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [llmProvider, setLlmProvider] = useState(defaultProvider);
  const [llmModel, setLlmModel] = useState(defaultModel);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const providerOptions = modelCatalog.providers;
  const modelsForProvider = providerOptions[llmProvider]?.models || [];
  const submitDisabled = loading || ingestionActive;
  const isPristine = useMemo(
    () =>
      !title
      && sourceType === "text"
      && !rawText
      && !url
      && !tags
      && !file
      && llmProvider === defaultProvider
      && llmModel === defaultModel,
    [defaultModel, defaultProvider, file, llmModel, llmProvider, rawText, sourceType, tags, title, url]
  );

  function resetForm() {
    setTitle("");
    setSourceType("text");
    setRawText("");
    setUrl("");
    setTags("");
    setFile(null);
    setLlmProvider(defaultProvider);
    setLlmModel(defaultModel);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sourceType === "file" && file) {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("source_type", sourceType);
      formData.append("raw_file", file);
      formData.append("tags", JSON.stringify(tags.split(",").map((tag) => tag.trim()).filter(Boolean)));
      formData.append("llm_provider", llmProvider);
      formData.append("llm_model", llmModel);
      await onSubmit(formData);
      resetForm();
      return;
    }

    await onSubmit({
      title,
      source_type: sourceType,
      raw_text: rawText,
      url,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      llm_provider: llmProvider,
      llm_model: llmModel,
    });
    resetForm();
  }

  return (
    <Card>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Title</label>
          <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Source type</label>
          <select className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="text">Pasted text</option>
            <option value="file">File</option>
            <option value="url">URL</option>
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Model provider</label>
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
            <label className="mb-1 block text-sm text-slate-300">Model</label>
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
          {modelsForProvider.find((model) => model.id === llmModel)?.notes || "Choose the model you want to use for extraction."}
        </div>
        {sourceType === "text" ? (
          <div>
            <label className="mb-1 block text-sm text-slate-300">Text</label>
            <textarea className="min-h-48 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={rawText} onChange={(event) => setRawText(event.target.value)} />
          </div>
        ) : null}
        {sourceType === "url" ? (
          <div>
            <label className="mb-1 block text-sm text-slate-300">URL</label>
            <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>
        ) : null}
        {sourceType === "file" ? (
          <div>
            <label className="mb-1 block text-sm text-slate-300">File</label>
            <input ref={fileInputRef} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Tags</label>
          <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="demo, product, pricing" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={submitDisabled} type="submit">
            {loading ? "Submitting..." : ingestionActive ? "Ingestion in progress" : "Start ingestion"}
          </Button>
          <Button
            className="bg-slate-700 text-white hover:bg-slate-600"
            disabled={loading || isPristine}
            onClick={resetForm}
            type="button"
          >
            Reset form
          </Button>
        </div>
      </form>
    </Card>
  );
}
