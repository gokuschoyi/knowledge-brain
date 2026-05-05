import { VStack } from '@chakra-ui/react';
import type { SelfHealingTask } from '../../api/types';
import { TaskCard } from './TaskCard';

export function TaskList({
  tasks,
  onRun,
  onIgnore,
}: {
  tasks: SelfHealingTask[];
  onRun: (id: number) => Promise<void>;
  onIgnore: (id: number) => Promise<void>;
}) {
  return (
    <VStack gap={4} align='stretch'>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onRun={onRun} onIgnore={onIgnore} />
      ))}
    </VStack>
  );
}
