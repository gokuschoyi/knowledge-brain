import {
  Badge,
  Box,
  Flex,
  Grid,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { JsonValue, SelfHealingTask } from '../../api/types';
import { Card } from '../common/Card';
import {
  getRepairTypeMeta,
  REPAIR_IMPACT_LABELS,
  type RepairImpactKind,
} from './taskTypeMeta';
import { getTaskCardSummary } from './taskCardSummary';

const statusConfig: Record<
  SelfHealingTask['status'],
  { palette: string; label: string; accent: string }
> = {
  pending: { palette: 'orange', label: 'Pending', accent: '#ea580c' },
  running: { palette: 'blue', label: 'Running', accent: '#3b82f6' },
  resolved: { palette: 'green', label: 'Resolved', accent: '#22c55e' },
  unresolved: { palette: 'orange', label: 'Unresolved', accent: '#f59e0b' },
  review_required: {
    palette: 'purple',
    label: 'Review Required',
    accent: '#a855f7',
  },
  failed: { palette: 'red', label: 'Failed', accent: '#ef4444' },
  ignored: { palette: 'gray', label: 'Ignored', accent: '#64748b' },
};

const impactPalette: Record<RepairImpactKind, string> = {
  graph_structure: 'cyan',
  entity_metadata: 'purple',
  advisory_only: 'blue',
  review_only: 'orange',
  unimplemented: 'gray',
};

function SectionDivider() {
  return <Box borderTopWidth='1px' borderColor='slate.800' />;
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text
        fontSize='xs'
        color='slate.500'
        textTransform='uppercase'
        letterSpacing='wider'
        mb='0.5'
      >
        {label}
      </Text>
      <Text fontSize='sm' color='white'>
        {value}
      </Text>
    </Box>
  );
}

function claimText(claim: JsonValue): string {
  if (typeof claim === 'string') return claim;
  if (claim && typeof claim === 'object' && !Array.isArray(claim)) {
    const c = claim as Record<string, JsonValue>;
    return typeof c['text'] === 'string' ? c['text'] : JSON.stringify(claim);
  }
  return String(claim);
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: JsonValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ResultSection({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text
        fontSize='xs'
        color='slate.500'
        textTransform='uppercase'
        letterSpacing='wider'
        mb='1'
      >
        {label}
      </Text>
      <Text fontSize='sm' color='slate.200'>
        {value}
      </Text>
    </Box>
  );
}

function renderTaskResult(task: SelfHealingTask) {
  if (!task.result || Object.keys(task.result).length === 0) {
    return null;
  }

  switch (task.task_type) {
    case 'missing_definition': {
      const definition = asString(task.result.definition);
      const confidence = asNumber(task.result.confidence);
      const evidenceChunkIds = asArray(task.result.evidence_chunk_ids);

      return (
        <Stack gap='3'>
          {definition ? (
            <ResultSection label='Updated definition' value={definition} />
          ) : null}
          <Grid templateColumns='1fr 1fr' gap='3'>
            {confidence !== null ? (
              <MetaField
                label='Confidence'
                value={`${(confidence * 100).toFixed(0)}%`}
              />
            ) : null}
            {evidenceChunkIds.length > 0 ? (
              <MetaField
                label='Evidence'
                value={formatCount(evidenceChunkIds.length, 'chunk')}
              />
            ) : null}
          </Grid>
          {evidenceChunkIds.length > 0 ? (
            <HStack gap='2' flexWrap='wrap'>
              {evidenceChunkIds.map((chunkId, index) => (
                <Badge
                  key={`${chunkId}-${index}`}
                  variant='subtle'
                  colorPalette='cyan'
                >
                  Chunk {String(chunkId)}
                </Badge>
              ))}
            </HStack>
          ) : null}
        </Stack>
      );
    }
    case 'duplicate_entity': {
      const canonicalId = asNumber(task.result.canonical_entity_id);
      const mergedIds = asArray(task.result.merged_entity_ids);
      const aliases = asArray(task.result.aliases)
        .map((alias) => asString(alias))
        .filter((alias): alias is string => Boolean(alias));

      return (
        <Stack gap='3'>
          <Grid templateColumns='1fr 1fr' gap='3'>
            {canonicalId !== null ? (
              <MetaField label='Canonical entity' value={`#${canonicalId}`} />
            ) : null}
            <MetaField
              label='Merged duplicates'
              value={formatCount(mergedIds.length, 'entity')}
            />
          </Grid>
          {mergedIds.length > 0 ? (
            <ResultSection
              label='Merged entity ids'
              value={mergedIds.map((id) => `#${String(id)}`).join(', ')}
            />
          ) : null}
          {aliases.length > 0 ? (
            <Box>
              <Text
                fontSize='xs'
                color='slate.500'
                textTransform='uppercase'
                letterSpacing='wider'
                mb='2'
              >
                Canonical aliases
              </Text>
              <HStack gap='2' flexWrap='wrap'>
                {aliases.map((alias) => (
                  <Badge key={alias} variant='subtle' colorPalette='purple'>
                    {alias}
                  </Badge>
                ))}
              </HStack>
            </Box>
          ) : null}
        </Stack>
      );
    }
    case 'low_confidence_answer': {
      const resultStatus = asString(task.result.status);
      const suggestion = asString(task.result.suggestion);
      const answer = asString(task.result.answer);
      const memoryId = asNumber(task.result.memory_id);
      const recommendedChunkIds = asArray(task.result.recommended_chunk_ids);
      const relatedEntityIds = asArray(task.result.related_entity_ids);

      return (
        <Stack gap='3'>
          {resultStatus ? (
            <MetaField
              label='Resolution'
              value={resultStatus.split('_').join(' ')}
            />
          ) : null}
          {recommendedChunkIds.length > 0 ? (
            <ResultSection
              label='Supporting evidence found'
              value={`Found ${formatCount(recommendedChunkIds.length, 'recommended chunk')} to review.`}
            />
          ) : null}
          {relatedEntityIds.length > 0 ? (
            <ResultSection
              label='Related entities'
              value={`${formatCount(relatedEntityIds.length, 'related entity')} surfaced from the graph.`}
            />
          ) : null}
          {suggestion ? (
            <ResultSection label='Suggested next step' value={suggestion} />
          ) : null}
          {answer ? (
            <ResultSection label='Previous answer' value={answer} />
          ) : null}
          {recommendedChunkIds.length > 0 ||
          relatedEntityIds.length > 0 ||
          memoryId !== null ? (
            <Grid templateColumns='1fr 1fr' gap='3'>
              {recommendedChunkIds.length > 0 ? (
                <MetaField
                  label='Recommended chunks'
                  value={String(recommendedChunkIds.length)}
                />
              ) : null}
              {relatedEntityIds.length > 0 ? (
                <MetaField
                  label='Related entities'
                  value={String(relatedEntityIds.length)}
                />
              ) : null}
              {memoryId !== null ? (
                <MetaField label='Repair memory' value={`#${memoryId}`} />
              ) : null}
            </Grid>
          ) : null}
        </Stack>
      );
    }
    case 'contradiction': {
      const resultStatus = asString(task.result.status);
      const message = asString(task.result.message);
      const resultClaims = asArray(task.result.claims);

      return (
        <Stack gap='3'>
          {resultStatus ? (
            <MetaField
              label='Review status'
              value={resultStatus.split('_').join(' ')}
            />
          ) : null}
          {message ? <ResultSection label='Outcome' value={message} /> : null}
          {resultClaims.length > 0 ? (
            <ResultSection
              label='Claims surfaced'
              value={formatCount(resultClaims.length, 'claim')}
            />
          ) : null}
        </Stack>
      );
    }
    default:
      return (
        <Box
          as='pre'
          fontSize='xs'
          color='slate.400'
          whiteSpace='pre-wrap'
          fontFamily='mono'
          bg='blackAlpha.400'
          p='2'
          borderRadius='md'
          overflow='auto'
          maxH='240px'
        >
          {JSON.stringify(task.result, null, 2)}
        </Box>
      );
  }
}

export function RepairResultPanel({ task }: { task: SelfHealingTask | null }) {
  if (!task) {
    return (
      <Card variant='panel' h='full' minH='0'>
        <Heading size='sm' color='white' mb='2'>
          Repair details
        </Heading>
        <Text fontSize='sm' color='slate.400'>
          Select a task to inspect what it will repair, and what happened when
          it ran.
        </Text>
      </Card>
    );
  }

  const repairMeta = getRepairTypeMeta(task.task_type);
  const summary = getTaskCardSummary(task);
  const cfg = statusConfig[task.status] ?? statusConfig.pending;

  const createdAt = new Date(task.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const completedAt = task.completed_at
    ? new Date(task.completed_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const claims = Array.isArray(task.payload?.claims)
    ? (task.payload.claims as JsonValue[])
    : [];

  const hasResult = task.result && Object.keys(task.result).length > 0;
  const isDone =
    task.status === 'resolved' ||
    task.status === 'unresolved' ||
    task.status === 'review_required' ||
    task.status === 'failed';

  return (
    <Card
      variant='panel'
      p='0'
      minH='0'
      overflow='hidden'
      borderLeftWidth='3px'
      style={{ borderLeftColor: cfg.accent }}
    >
      <Stack gap='0' h='full' minH='0' overflowY='auto'>
        {/* ── Header ── */}
        <Box px='4' pt='4' pb='3'>
          <Flex justify='space-between' align='flex-start' mb='2' gap='2'>
            <Badge
              colorPalette={cfg.palette}
              textTransform='uppercase'
              size='sm'
              flexShrink={0}
            >
              {cfg.label}
            </Badge>
            <HStack gap='1' flexWrap='wrap' justify='flex-end'>
              {repairMeta.impacts.map((impact) => (
                <Badge
                  key={impact}
                  colorPalette={impactPalette[impact]}
                  variant='subtle'
                  size='xs'
                >
                  {REPAIR_IMPACT_LABELS[impact]}
                </Badge>
              ))}
            </HStack>
          </Flex>

          <Heading size='sm' color='white' mb='1'>
            {task.title}
          </Heading>
          <Text fontSize='sm' color='slate.400' lineClamp={3}>
            {summary.secondaryText}
          </Text>
        </Box>

        <SectionDivider />

        {/* ── Metadata grid ── */}
        <Grid templateColumns='1fr 1fr' gap='3' px='4' py='3'>
          <MetaField label='Type' value={repairMeta.label} />
          <MetaField label='Priority' value={String(task.priority)} />
          <MetaField label='Brain' value={task.brain_name || '—'} />
          <MetaField label='Created' value={createdAt} />
          {completedAt && <MetaField label='Finished' value={completedAt} />}
        </Grid>

        {/* ── Context chips ── */}
        {(task.related_document_title ||
          task.related_entity_name ||
          (summary.showConfidence && summary.confidenceValue !== null)) && (
          <>
            <SectionDivider />
            <HStack px='4' py='3' gap='2' flexWrap='wrap'>
              {task.related_document_title && (
                <Badge colorPalette='cyan' variant='subtle'>
                  📄 {task.related_document_title}
                </Badge>
              )}
              {task.related_entity_name && (
                <Badge colorPalette='purple' variant='subtle'>
                  🔷 {task.related_entity_name}
                </Badge>
              )}
              {summary.showConfidence && summary.confidenceValue !== null && (
                <Badge
                  colorPalette={
                    summary.confidenceValue < 0.6 ? 'orange' : 'blue'
                  }
                  variant='subtle'
                >
                  Confidence {(summary.confidenceValue * 100).toFixed(0)}%
                </Badge>
              )}
            </HStack>
          </>
        )}

        {/* ── Low-confidence payload ── */}
        {task.task_type === 'low_confidence_answer' &&
          task.payload?.question && (
            <>
              <SectionDivider />
              <Stack gap='3' px='4' py='3'>
                <Box>
                  <Text
                    fontSize='xs'
                    color='slate.500'
                    textTransform='uppercase'
                    letterSpacing='wider'
                    mb='1'
                  >
                    Question
                  </Text>
                  <Text fontSize='sm' color='white'>
                    {String(task.payload.question)}
                  </Text>
                </Box>
                {task.payload?.answer && (
                  <Box>
                    <Text
                      fontSize='xs'
                      color='slate.500'
                      textTransform='uppercase'
                      letterSpacing='wider'
                      mb='1'
                    >
                      Original reply
                    </Text>
                    <Text
                      fontSize='sm'
                      color='slate.300'
                      lineClamp={4}
                      fontStyle='italic'
                    >
                      "{String(task.payload.answer)}"
                    </Text>
                  </Box>
                )}
              </Stack>
            </>
          )}

        {/* ── Contradiction claims ── */}
        {task.task_type === 'contradiction' && claims.length > 0 && (
          <>
            <SectionDivider />
            <Box px='4' py='3'>
              <Text
                fontSize='xs'
                color='slate.500'
                textTransform='uppercase'
                letterSpacing='wider'
                mb='2'
              >
                Conflicting claims · {claims.length}
              </Text>
              <Stack gap='2'>
                {claims.map((claim, i) => (
                  <Box
                    key={i}
                    p='2'
                    bg='orange.900/20'
                    borderRadius='md'
                    borderLeftWidth='2px'
                    borderLeftColor='orange.500'
                  >
                    <Text fontSize='xs' color='slate.300'>
                      {claimText(claim)}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}

        {/* ── Outcome block ── */}
        {isDone && (
          <>
            <SectionDivider />
            <Box
              px='4'
              py='3'
              bg={
                task.status === 'failed'
                  ? 'red.900/20'
                  : task.status === 'review_required'
                    ? 'purple.900/20'
                    : task.status === 'unresolved'
                      ? 'orange.900/20'
                      : 'green.900/20'
              }
            >
              {summary.outcomeText && (
                <Text
                  fontSize='sm'
                  fontWeight='semibold'
                  color={
                    task.status === 'failed'
                      ? 'red.300'
                      : task.status === 'review_required'
                        ? 'purple.300'
                        : task.status === 'unresolved'
                          ? 'orange.300'
                          : 'green.300'
                  }
                  mb={task.error_message || hasResult ? '2' : '0'}
                >
                  {task.status === 'failed' ? '✗' : '✓'} {summary.outcomeText}
                </Text>
              )}

              {task.error_message && (
                <Text fontSize='xs' color='red.200'>
                  {task.error_message}
                </Text>
              )}

              {hasResult && !task.error_message && renderTaskResult(task)}
            </Box>
          </>
        )}
      </Stack>
    </Card>
  );
}
