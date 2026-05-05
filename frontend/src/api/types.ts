export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DocumentSourceType = 'text' | 'file' | 'url';

export type DocumentSummary = {
  id: number;
  title: string;
  source_type: DocumentSourceType;
  tags: string[];
  llm_provider: string;
  llm_model: string;
  status: DocumentStatus;
  summary: string;
  quality_score: number;
  error_message: string;
  created_at: string;
  updated_at: string;
  chunks_count: number;
};

export type IngestionLogEntry = {
  step: string;
  message: string;
};

export type IngestionJob = {
  id: number;
  document: number;
  status: DocumentStatus;
  current_step: string;
  progress: number;
  log: IngestionLogEntry[];
  error_message: string;
  created_at: string;
  updated_at: string;
};

export type Chunk = {
  id: number;
  document: number;
  text: string;
  summary: string;
  chunk_index: number;
  token_count: number;
  importance_score: number;
  quality_score: number;
  metadata: JsonValue;
};

export type Entity = {
  id: number;
  brain: string | null;
  name: string;
  canonical_name: string;
  entity_type: string;
  description: string;
  confidence: number;
  embedding: number[] | null;
  aliases: string[];
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
};

export type DocumentEntity = Pick<
  Entity,
  | 'id'
  | 'name'
  | 'canonical_name'
  | 'entity_type'
  | 'description'
  | 'confidence'
  | 'aliases'
>;

export type Relationship = {
  id: number;
  source_entity: number;
  target_entity: number;
  source_name: string;
  target_name: string;
  relationship_type: string;
  evidence_chunk: number;
  confidence: number;
  metadata: JsonValue;
  created_at: string;
};

export type DocumentRelationship = Pick<
  Relationship,
  | 'id'
  | 'source_entity'
  | 'target_entity'
  | 'source_name'
  | 'target_name'
  | 'relationship_type'
  | 'confidence'
>;

export type ChatSource = {
  document_id: number;
  document_title: string;
  chunk_id: number;
  snippet: string;
};

export type ChatRelatedEntity = {
  id: number;
  name: string;
  type: string;
};

export type ChatResponse = {
  session_id: number;
  answer: string;
  confidence_score: number;
  llm_provider?: string;
  llm_model?: string;
  sources: ChatSource[];
  related_entities: ChatRelatedEntity[];
  knowledge_gaps: string[];
  self_healing_task_created: boolean;
  should_create_self_healing_task?: boolean;
};

export type ChatMessage = {
  id: number;
  session: number;
  role: 'user' | 'assistant';
  content: string;
  confidence_score: number | null;
  sources: JsonValue[];
  metadata: { [key: string]: JsonValue };
  created_at: string;
};

export type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  messages: ChatMessage[];
};

export type GraphNodeData = DocumentSummary | Entity;

export type GraphNode = {
  id: string;
  type: 'document' | 'entity';
  label: string;
  data: GraphNodeData;
  position?: { x: number; y: number };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  data: {
    relationship_id: number;
    confidence: number;
  };
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SelfHealingTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'ignored';

export type SelfHealingTask = {
  id: number;
  brain: string | null;
  task_type: string;
  status: SelfHealingTaskStatus;
  priority: number;
  title: string;
  description: string;
  related_document: number | null;
  related_chunk: number | null;
  related_entity: number | null;
  payload: { [key: string]: JsonValue };
  result: { [key: string]: JsonValue };
  error_message: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  related_entity_name?: string;
  related_document_title?: string;
  brain_name?: string;
};

export type SelfHealingRunResponse = {
  status: 'queued';
  task_id: number;
};

export type SelfHealingRunAllResponse = {
  queued_task_ids: number[];
};

export type DocumentIngestResponse = {
  document_id: number;
  job_id: number;
  status: DocumentStatus;
};
