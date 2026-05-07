export type RepairImpactKind =
  | 'graph_structure'
  | 'entity_metadata'
  | 'advisory_only'
  | 'review_only'
  | 'unimplemented';

export type RepairTypeMeta = {
  label: string;
  summary: string;
  impacts: RepairImpactKind[];
};

export const REPAIR_IMPACT_LABELS: Record<RepairImpactKind, string> = {
  graph_structure: 'Changes graph structure',
  entity_metadata: 'Updates entity metadata',
  advisory_only: 'Recommendations only',
  review_only: 'Human review only',
  unimplemented: 'No automated repair yet',
};

export const REPAIR_TYPE_META: Record<string, RepairTypeMeta> = {
  duplicate_entity: {
    label: 'Duplicate Entity',
    summary:
      'Merges duplicate entities and rewires their mentions, claims, and relationships.',
    impacts: ['graph_structure', 'entity_metadata'],
  },
  missing_definition: {
    label: 'Missing Definition',
    summary:
      'Writes a stronger description and confidence score onto the entity.',
    impacts: ['entity_metadata'],
  },
  low_confidence_answer: {
    label: 'Low Confidence Answer',
    summary:
      'Finds better supporting chunks and related entities, but does not write them back.',
    impacts: ['advisory_only'],
  },
  contradiction: {
    label: 'Contradiction',
    summary:
      'Surfaces conflicting claims for manual review instead of auto-resolving them.',
    impacts: ['review_only'],
  },
  orphan_chunk: {
    label: 'Orphan Chunk',
    summary:
      'Task type exists, but there is no automated repair runner registered for it yet.',
    impacts: ['unimplemented'],
  },
};

export function getRepairTypeMeta(taskType: string): RepairTypeMeta {
  return (
    REPAIR_TYPE_META[taskType] ?? {
      label: taskType.split('_').join(' '),
      summary:
        'This repair type does not have an explicit impact description yet.',
      impacts: [],
    }
  );
}
