import {
  Flex,
  Box,
  Heading,
  Text,
  Badge,
  HStack,
  Stack,
} from '@chakra-ui/react';
import type { SelfHealingTask } from '../../api/types';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { REPAIR_IMPACT_LABELS, type RepairImpactKind } from './taskTypeMeta';
import { getTaskCardSummary } from './taskCardSummary';

export function TaskCard({
  task,
  isSelected,
  onSelect,
  onRun,
  onIgnore,
}: {
  task: SelfHealingTask;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onRun: (id: number) => Promise<void>;
  onIgnore: (id: number) => Promise<void>;
}) {
  const statusPalette =
    task.status === 'completed'
      ? 'green'
      : task.status === 'pending'
        ? 'orange'
        : task.status === 'running'
          ? 'blue'
          : task.status === 'failed'
            ? 'red'
            : 'gray';
  const summary = getTaskCardSummary(task);
  const impactPalette: Record<RepairImpactKind, string> = {
    graph_structure: 'cyan',
    entity_metadata: 'purple',
    advisory_only: 'blue',
    review_only: 'orange',
    unimplemented: 'gray',
  };

  function renderContextChip(index: number) {
    const chip = summary.contextChips[index];

    if (chip.kind === 'document') {
      return (
        <Badge
          key={`document-${chip.label}`}
          colorPalette='cyan'
          variant='subtle'
        >
          Doc: {chip.label}
        </Badge>
      );
    }

    if (chip.kind === 'entity') {
      return (
        <Badge
          key={`entity-${chip.label}`}
          colorPalette='purple'
          variant='subtle'
        >
          Entity: {chip.label}
        </Badge>
      );
    }

    return (
      <Badge
        key={`impact-${chip.impact}`}
        colorPalette={impactPalette[chip.impact]}
        variant='subtle'
      >
        {REPAIR_IMPACT_LABELS[chip.impact]}
      </Badge>
    );
  }

  return (
    <Card
      borderColor={isSelected ? 'brand.500' : 'slate.800'}
      bg={isSelected ? 'rgba(15, 23, 42, 0.92)' : 'slate.900'}
      cursor='pointer'
      onClick={() => onSelect(task.id)}
    >
      <Flex mb='2' align='flex-start' justify='space-between' gap='3'>
        <Box>
          <Heading size='sm' color='white'>
            {task.title}
          </Heading>
          <Text mt='1' fontSize='sm' color='slate.300' lineClamp={2}>
            {summary.primaryLabel}
          </Text>
        </Box>
        <Badge size='sm' colorPalette={statusPalette} textTransform='uppercase'>
          {task.status}
        </Badge>
      </Flex>

      <Stack mb='4' gap='2'>
        <Text fontSize='sm' color='slate.400' lineClamp={2}>
          {summary.secondaryText}
        </Text>

        <HStack gap='2' fontSize='xs' color='slate.400' flexWrap='wrap'>
          {summary.contextChips.map((_, index) => renderContextChip(index))}
        </HStack>

        {summary.showConfidence && summary.confidenceValue !== null ? (
          <HStack gap='2' fontSize='xs' color='slate.500'>
            <Badge
              colorPalette={summary.confidenceValue < 0.6 ? 'orange' : 'blue'}
              variant='subtle'
            >
              Confidence {(summary.confidenceValue * 100).toFixed(0)}%
            </Badge>
          </HStack>
        ) : null}

        {summary.outcomeText ? (
          <Text
            fontSize='xs'
            color={
              task.status === 'failed'
                ? 'red.300'
                : task.status === 'completed'
                  ? 'green.300'
                  : task.status === 'ignored'
                    ? 'slate.500'
                    : 'slate.500'
            }
          >
            {summary.outcomeText}
          </Text>
        ) : null}
      </Stack>

      <HStack gap='2' align='stretch'>
        <Button
          size='sm'
          variant={summary.runButtonVariant}
          onClick={(event) => {
            event.stopPropagation();
            void onRun(task.id);
          }}
          disabled={
            task.status === 'running' ||
            task.status === 'completed' ||
            task.task_type === 'orphan_chunk'
          }
        >
          {summary.runButtonLabel}
        </Button>
        <Button
          size='sm'
          variant='outline'
          colorPalette='slate'
          onClick={(event) => {
            event.stopPropagation();
            void onIgnore(task.id);
          }}
          disabled={task.status === 'ignored'}
        >
          Ignore
        </Button>
      </HStack>
    </Card>
  );
}
