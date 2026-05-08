import type { JsonValue, SelfHealingTask } from '../../api/types';
import { getRepairTypeMeta, type RepairImpactKind } from './taskTypeMeta';

export type TaskCardContextChip =
  | {
      kind: 'document';
      label: string;
    }
  | {
      kind: 'entity';
      label: string;
    }
  | {
      kind: 'impact';
      impact: RepairImpactKind;
    };

export type TaskCardSummary = {
  primaryLabel: string;
  secondaryText: string;
  outcomeText: string | null;
  showConfidence: boolean;
  confidenceValue: number | null;
  contextChips: TaskCardContextChip[];
  runButtonLabel: string;
  runButtonVariant?:
    | 'solid'
    | 'outline'
    | 'subtle'
    | 'surface'
    | 'ghost'
    | 'plain';
};

function asNumber(value: JsonValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildBaseSummary(task: SelfHealingTask): TaskCardSummary {
  const repairMeta = getRepairTypeMeta(task.task_type);
  const primaryLabel = task.related_entity_name || repairMeta.label;
  const contextChips: TaskCardContextChip[] = [];

  if (task.related_document_title) {
    contextChips.push({
      kind: 'document',
      label: task.related_document_title,
    });
  }

  if (task.related_entity_name) {
    contextChips.push({
      kind: 'entity',
      label: task.related_entity_name,
    });
  }

  repairMeta.impacts.forEach((impact) => {
    contextChips.push({
      kind: 'impact',
      impact,
    });
  });

  return {
    primaryLabel,
    secondaryText: task.description,
    outcomeText: null,
    showConfidence: false,
    confidenceValue: null,
    contextChips,
    runButtonLabel: 'Run Repair',
  };
}

export function getTaskCardSummary(task: SelfHealingTask): TaskCardSummary {
  const summary = buildBaseSummary(task);

  switch (task.task_type) {
    case 'missing_definition': {
      const evidenceCount = asArray(task.result.evidence_chunk_ids).length;
      summary.primaryLabel = task.related_entity_name || 'Missing definition';
      summary.secondaryText =
        task.status === 'completed'
          ? 'Definition updated from document evidence'
          : 'Will generate a stronger definition from document evidence';
      summary.outcomeText =
        task.status === 'completed'
          ? evidenceCount > 0
            ? `Definition updated using ${formatCount(evidenceCount, 'evidence chunk')}`
            : 'Definition updated'
          : task.status === 'failed'
            ? 'Repair failed'
            : task.status === 'ignored'
              ? 'Ignored'
              : null;
      return summary;
    }
    case 'duplicate_entity': {
      const mergedCount = asArray(task.result.merged_entity_ids).length;
      summary.primaryLabel = task.related_entity_name || 'Duplicate entities';
      summary.secondaryText =
        task.status === 'completed'
          ? 'Duplicate entities were merged and references were rewired'
          : 'Will merge duplicate entities and rewire references';
      summary.outcomeText =
        task.status === 'completed'
          ? mergedCount > 0
            ? `Merged ${formatCount(mergedCount, 'duplicate')}`
            : 'Entities merged'
          : task.status === 'failed'
            ? 'Repair failed'
            : task.status === 'ignored'
              ? 'Ignored'
              : null;
      return summary;
    }
    case 'low_confidence_answer': {
      const question = asString(task.payload.question);
      const confidence = asNumber(task.payload.confidence_score);
      const resultStatus = asString(task.result.status);
      summary.primaryLabel = question || task.title;
      summary.secondaryText =
        resultStatus === 'improved'
          ? 'Found stronger evidence for the answer'
          : resultStatus === 'unresolved'
            ? 'Could not fully resolve the weak answer from current knowledge'
            : 'Review the weak-answer context and supporting evidence';
      summary.showConfidence = confidence !== null;
      summary.confidenceValue = confidence;
      summary.outcomeText =
        task.status === 'completed'
          ? resultStatus === 'improved'
            ? 'Found improved evidence'
            : resultStatus === 'unresolved'
              ? 'Still unresolved'
              : 'Repair completed'
          : task.status === 'failed'
            ? 'Repair failed'
            : task.status === 'ignored'
              ? 'Ignored'
              : null;
      return summary;
    }
    case 'contradiction': {
      const claimCount = asArray(task.payload.claims).length;
      summary.primaryLabel = task.related_entity_name || task.title;
      summary.secondaryText =
        claimCount > 0
          ? `Manual review required across ${formatCount(claimCount, 'conflicting claim')}`
          : 'Manual review required for conflicting claims';
      summary.outcomeText =
        task.status === 'completed'
          ? 'Prepared for review'
          : task.status === 'failed'
            ? 'Review preparation failed'
            : task.status === 'ignored'
              ? 'Ignored'
              : null;
      return summary;
    }
    case 'orphan_chunk': {
      summary.primaryLabel = task.title;
      summary.secondaryText =
        'No automated repair is available for this task yet';
      summary.outcomeText =
        task.status === 'failed'
          ? 'No repair runner available'
          : task.status === 'ignored'
            ? 'Ignored'
            : null;
      summary.runButtonLabel = 'Unavailable';
      summary.runButtonVariant = 'outline';
      return summary;
    }
    default: {
      summary.outcomeText =
        task.status === 'failed'
          ? 'Repair failed'
          : task.status === 'ignored'
            ? 'Ignored'
            : task.status === 'completed'
              ? 'Repair completed'
              : null;
      return summary;
    }
  }
}
