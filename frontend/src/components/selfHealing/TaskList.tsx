import { Stack, VStack } from '@chakra-ui/react';
import type { SelfHealingTask } from '../../api/types';
import { TaskCard } from './TaskCard';

export function TaskList({
  tasks,
  selectedTaskId,
  onSelect,
  onRun,
  onIgnore,
  onDelete,
}: {
  tasks: SelfHealingTask[];
  selectedTaskId: number | null;
  onSelect: (id: number) => void;
  onRun: (id: number) => Promise<void>;
  onIgnore: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <Stack gap={3} pl={6} pb={2}>
      <VStack gap={4} align='stretch'>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
            onSelect={onSelect}
            onRun={onRun}
            onIgnore={onIgnore}
            onDelete={onDelete}
          />
        ))}
      </VStack>
    </Stack>
  );
}
