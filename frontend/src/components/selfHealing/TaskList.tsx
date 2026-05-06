import { Heading, Stack, Text, VStack } from '@chakra-ui/react';
import type { SelfHealingTask } from '../../api/types';
import { TaskCard } from './TaskCard';

export function TaskList({
  tasks,
  selectedTaskId,
  onSelect,
  onRun,
  onIgnore,
}: {
  tasks: SelfHealingTask[];
  selectedTaskId: number | null;
  onSelect: (id: number) => void;
  onRun: (id: number) => Promise<void>;
  onIgnore: (id: number) => Promise<void>;
}) {
  const sections = [
    {
      key: 'pending',
      title: 'Ready to repair',
      tasks: tasks.filter((task) => task.status === 'pending'),
    },
    {
      key: 'running',
      title: 'In progress',
      tasks: tasks.filter((task) => task.status === 'running'),
    },
    {
      key: 'failed',
      title: 'Needs attention',
      tasks: tasks.filter((task) => task.status === 'failed'),
    },
    {
      key: 'completed',
      title: 'Completed',
      tasks: tasks.filter((task) => task.status === 'completed'),
    },
    {
      key: 'ignored',
      title: 'Ignored',
      tasks: tasks.filter((task) => task.status === 'ignored'),
    },
  ].filter((section) => section.tasks.length > 0);

  return (
    <Stack gap={6} pl={6} pb={2}>
      {sections.map((section) => (
        <Stack key={section.key} gap={3}>
          <Stack gap={1}>
            <Heading size='sm' color='white'>
              {section.title}
            </Heading>
            <Text fontSize='sm' color='slate.500'>
              {section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}
            </Text>
          </Stack>
          <VStack gap={4} align='stretch'>
            {section.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                onSelect={onSelect}
                onRun={onRun}
                onIgnore={onIgnore}
              />
            ))}
          </VStack>
        </Stack>
      ))}
    </Stack>
  );
}
