import { Stack, Text, VStack } from '@chakra-ui/react';
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
  return (
    <Stack gap={3} pl={6} pb={2}>
      <Text fontSize='sm' color='slate.500'>
        Tasks stay in a stable order while their repair status updates.
      </Text>
      <VStack gap={4} align='stretch'>
        {tasks.map((task) => (
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
  );
}
