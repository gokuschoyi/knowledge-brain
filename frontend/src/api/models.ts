import { apiFetch } from './client';

export type ModelOption = {
  id: string;
  label: string;
  recommended: boolean;
  notes: string;
};

export type ProviderOption = {
  label: string;
  api_key_env: string;
  models: ModelOption[];
  supported?: boolean;
  notes?: string;
};

export type ModelCatalog = {
  default_provider: string;
  default_model: string;
  providers: Record<string, ProviderOption>;
  embedding_provider: string;
  embedding_model: string;
  embedding: {
    active_provider: string;
    active_model: string;
    fallback_provider: string;
    fallback_model: string;
    notes: string;
  };
};

export function getModelCatalog() {
  return apiFetch<ModelCatalog>('/models/');
}
