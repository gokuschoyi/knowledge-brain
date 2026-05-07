import {
  Badge,
  Box,
  Code,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { SelfHealingTask } from '../../api/types';
import { Card } from '../common/Card';
import {
  getRepairTypeMeta,
  REPAIR_IMPACT_LABELS,
  type RepairImpactKind,
} from './taskTypeMeta';

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
  const impactPalette: Record<RepairImpactKind, string> = {
    graph_structure: 'cyan',
    entity_metadata: 'purple',
    advisory_only: 'blue',
    review_only: 'orange',
    unimplemented: 'gray',
  };

  return (
    <Card>
      <Stack gap='4'>
        <Box>
          <Heading size='sm' color='white' mb='2'>
            {task.title}
          </Heading>
          <Text fontSize='sm' color='slate.400'>
            {task.description}
          </Text>
        </Box>

        <Box>
          <Heading size='xs' color='white' mb='2'>
            What this repair changes
          </Heading>
          <Text fontSize='sm' color='slate.300'>
            {repairMeta.summary}
          </Text>
          {repairMeta.impacts.length > 0 ? (
            <HStack mt='3' gap='2' wrap='wrap'>
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
          ) : null}
        </Box>

        <Stack gap='2' fontSize='sm' color='slate.300'>
          <Text>
            <Text as='span' color='slate.500'>
              Status:
            </Text>{' '}
            {task.status}
          </Text>
          <Text>
            <Text as='span' color='slate.500'>
              Type:
            </Text>{' '}
            {task.task_type.split('_').join(' ')}
          </Text>
          <Text>
            <Text as='span' color='slate.500'>
              Brain:
            </Text>{' '}
            {task.brain_name || 'Not linked'}
          </Text>
          {task.related_document_title ? (
            <Text>
              <Text as='span' color='slate.500'>
                Document:
              </Text>{' '}
              {task.related_document_title}
            </Text>
          ) : null}
          {task.related_entity_name ? (
            <Text>
              <Text as='span' color='slate.500'>
                Entity:
              </Text>{' '}
              {task.related_entity_name}
            </Text>
          ) : null}
        </Stack>

        {task.error_message ? (
          <Box>
            <Heading size='xs' color='red.300' mb='2'>
              Error
            </Heading>
            <Text fontSize='sm' color='red.200'>
              {task.error_message}
            </Text>
          </Box>
        ) : null}

        {task.payload && task.payload.question && (
          <Box mb='4'>
            <Heading size='xs' color='blue.300' mb='1'>
              Question
            </Heading>
            <Text fontSize='sm' color='white'>
              {String(task.payload.question)}
            </Text>
          </Box>
        )}

        {task.payload && task.payload.answer && (
          <Box mb='4'>
            <Heading size='xs' color='green.300' mb='1'>
              Original Reply
            </Heading>
            <Text fontSize='sm' color='slate.200'>
              {String(task.payload.answer)}
            </Text>
          </Box>
        )}

        {task.payload && Object.keys(task.payload).length > 0 ? (
          <Box>
            <Heading size='xs' color='white' mb='2'>
              Repair input
            </Heading>
            <Code
              variant='plain'
              display='block'
              whiteSpace='pre-wrap'
              fontSize='xs'
              color='slate.300'
            >
              {JSON.stringify(task.payload, null, 2)}
            </Code>
          </Box>
        ) : null}

        {task.result && Object.keys(task.result).length > 0 ? (
          <Box>
            <Heading size='xs' color='white' mb='2'>
              Repair result
            </Heading>
            <Code
              variant='plain'
              display='block'
              whiteSpace='pre-wrap'
              fontSize='xs'
              color='slate.300'
            >
              {JSON.stringify(task.result, null, 2)}
            </Code>
          </Box>
        ) : (
          <Text fontSize='sm' color='slate.500'>
            No repair result yet.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
