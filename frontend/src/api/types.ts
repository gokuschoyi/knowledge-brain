export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DocumentSourceType = 'text' | 'file' | 'url';
export type DocumentSourceAuthority =
  | 'unknown'
  | 'user_provided'
  | 'secondary'
  | 'primary';

export type DocumentSummary = {
  id: number;
  title: string;
  source_type: DocumentSourceType;
  source_label?: string;
  source_authority: DocumentSourceAuthority;
  source_authority_label?: string;
  source_published_at?: string | null;
  source_observed_at?: string | null;
  tags: string[];
  llm_provider: string;
  llm_model: string;
  status: DocumentStatus;
  status_label?: string;
  summary: string;
  quality_score: number;
  error_message: string;
  created_at: string;
  updated_at: string;
  latest_activity_at?: string;
  chunks_count: number;
  brain_name?: string;
  latest_job_status?: string | null;
};

export type IngestionLogEntry = {
  step: string;
  status?: string;
  message: string;
};

export type IngestionStage = {
  key: string;
  label: string;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'warning';
  message: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type IngestionChunkProgress = {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  successful_artifacts: number;
};

export type IngestionChunkDetail = {
  chunk_id: number;
  chunk_index: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  attempt_count: number;
  error_message: string;
  empty_verification_status?:
    | 'not_needed'
    | 'verified_empty'
    | 'retry_recommended';
  empty_verification_message?: string;
};

export type IngestionJob = {
  id: number;
  document: number;
  document_title: string;
  status: DocumentStatus;
  current_step: string;
  progress: number;
  log: IngestionLogEntry[];
  metadata: { [key: string]: JsonValue };
  error_message: string;
  created_at: string;
  updated_at: string;
  stages: IngestionStage[];
  chunk_progress: IngestionChunkProgress;
  chunk_details: IngestionChunkDetail[];
};

export type ChunkExtractionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

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
  extraction_status: ChunkExtractionStatus;
  entity_count: number;
  relationship_count: number;
  claim_count: number;
  verified_empty: boolean;
  verification_message: string;
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
  score?: number;
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
  source_count?: number;
  metadata: { [key: string]: JsonValue };
  created_at: string;
};

export type ChatSession = {
  id: number;
  title: string;
  summary: string;
  created_at: string;
  last_message_at?: string;
  message_count?: number;
  brain_name?: string;
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

export type PartitionedGraphResponse = {
  connected_graph: GraphResponse;
  isolated_entities: GraphNode[];
};

export type SelfHealingTaskStatus =
  | 'pending'
  | 'running'
  | 'resolved'
  | 'unresolved'
  | 'review_required'
  | 'failed'
  | 'ignored';

export type SelfHealingTask = {
  id: number;
  brain: string | null;
  task_type: string;
  task_type_label?: string;
  status: SelfHealingTaskStatus;
  priority: number;
  priority_label?: string;
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
  can_run?: boolean;
  can_delete?: boolean;
};

export type SelfHealingRunResponse = {
  status: 'queued';
  task_id: number;
};

export type SelfHealingRunAllResponse = {
  queued_task_ids: number[];
};

export type SelfHealingAttachEvidenceResponse = {
  document_id: number;
  job_id: number;
  status: DocumentStatus;
  task_id: number;
  rerun_task_recommended: boolean;
  next_action?: string;
};

export type DocumentIngestResponse = {
  document_id: number;
  job_id: number;
  status: DocumentStatus;
};

export type BatchJobSummary = {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  overall_progress: number;
  all_terminal: boolean;
};

export type BatchJobResponse = {
  jobs: IngestionJob[];
  summary: BatchJobSummary;
};
