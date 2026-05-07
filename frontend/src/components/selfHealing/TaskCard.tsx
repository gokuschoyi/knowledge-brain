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
import {
  getRepairTypeMeta,
  REPAIR_IMPACT_LABELS,
  type RepairImpactKind,
} from './taskTypeMeta';

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
  const repairMeta = getRepairTypeMeta(task.task_type);
  const impactPalette: Record<RepairImpactKind, string> = {
    graph_structure: 'cyan',
    entity_metadata: 'purple',
    advisory_only: 'blue',
    review_only: 'orange',
    unimplemented: 'gray',
  };

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
          <Text mt='1' fontSize='sm' color='slate.400'>
            {task.description}
          </Text>
        </Box>
        <Badge size='sm' colorPalette={statusPalette} textTransform='uppercase'>
          {task.status}
        </Badge>
      </Flex>

      <Stack mb='4' gap='2'>
        <HStack gap='2' fontSize='xs' color='slate.500' flexWrap='wrap'>
          <Text fontWeight='bold' color='slate.400' textTransform='uppercase'>
            {task.task_type.split('_').join(' ')}
          </Text>
          <Text>·</Text>
          <Text>Priority {task.priority}</Text>
          {task.payload.confidence_score !== undefined && (
            <>
              <Text>·</Text>
              <Text
                color={
                  Number(task.payload.confidence_score) < 0.6
                    ? 'orange.400'
                    : 'slate.500'
                }
              >
                Confidence{' '}
                {(Number(task.payload.confidence_score) * 100).toFixed(0)}%
              </Text>
            </>
          )}
          {task.brain_name ? (
            <>
              <Text>·</Text>
              <Text>{task.brain_name}</Text>
            </>
          ) : null}
        </HStack>

        <HStack gap='2' fontSize='xs' color='slate.400' flexWrap='wrap'>
          {task.related_document_title ? (
            <Badge colorPalette='cyan' variant='subtle'>
              Doc: {task.related_document_title}
            </Badge>
          ) : null}
          {task.related_entity_name ? (
            <Badge colorPalette='purple' variant='subtle'>
              Entity: {task.related_entity_name}
            </Badge>
          ) : null}
          {repairMeta.impacts.map((impact) => (
            <Badge
              key={impact}
              colorPalette={impactPalette[impact]}
              variant='subtle'
            >
              {REPAIR_IMPACT_LABELS[impact]}
            </Badge>
          ))}
        </HStack>
      </Stack>

      <Text mb='4' fontSize='xs' color='slate.500'>
        {task.status === 'completed'
          ? 'Repair finished. Select this task to inspect the result.'
          : task.status === 'running'
            ? 'Repair is currently in progress.'
            : task.status === 'failed'
              ? 'Repair failed. Select this task to inspect the error.'
              : task.status === 'ignored'
                ? 'This task has been ignored.'
                : 'Select this task to review context before running it.'}
      </Text>

      <HStack gap='2'>
        <Button
          size='sm'
          onClick={(event) => {
            event.stopPropagation();
            void onRun(task.id);
          }}
          disabled={task.status === 'running' || task.status === 'completed'}
        >
          Run Repair
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
