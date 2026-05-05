import { VStack } from '@chakra-ui/react';
import { TaskCard } from './TaskCard';

export function TaskList({
  tasks,
  onRun,
  onIgnore,
}: {
  tasks: any[];
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
