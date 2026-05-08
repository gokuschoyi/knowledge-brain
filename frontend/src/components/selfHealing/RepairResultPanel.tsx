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
  completed: { palette: 'green', label: 'Completed', accent: '#22c55e' },
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

export function RepairResultPanel({ task }: { task: SelfHealingTask | null }) {
  if (!task) {
    return (
      <Card>
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
  const isDone = task.status === 'completed' || task.status === 'failed';

  return (
    <Card
      p='0'
      overflow='hidden'
      borderLeftWidth='3px'
      style={{ borderLeftColor: cfg.accent }}
    >
      <Stack gap='0'>
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
          {completedAt && <MetaField label='Completed' value={completedAt} />}
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
              bg={task.status === 'completed' ? 'green.900/20' : 'red.900/20'}
            >
              {summary.outcomeText && (
                <Text
                  fontSize='sm'
                  fontWeight='semibold'
                  color={task.status === 'completed' ? 'green.300' : 'red.300'}
                  mb={task.error_message || hasResult ? '2' : '0'}
                >
                  {task.status === 'completed' ? '✓' : '✗'}{' '}
                  {summary.outcomeText}
                </Text>
              )}

              {task.error_message && (
                <Text fontSize='xs' color='red.200'>
                  {task.error_message}
                </Text>
              )}

              {hasResult && !task.error_message && (
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
                  maxH='140px'
                >
                  {JSON.stringify(task.result, null, 2)}
                </Box>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Card>
  );
}
