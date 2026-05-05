import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ignoreSelfHealingTask,
  listSelfHealingTasks,
  runSelfHealingTask,
} from '../api/selfHealing';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { TaskList } from '../components/selfHealing/TaskList';

export function SelfHealingPage() {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({
    queryKey: ['self-healing'],
    queryFn: listSelfHealingTasks,
  });
  const runMutation = useMutation({
    mutationFn: runSelfHealingTask,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['self-healing'] }),
  });
  const ignoreMutation = useMutation({
    mutationFn: ignoreSelfHealingTask,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['self-healing'] }),
  });

  if (tasksQuery.isLoading)
    return <LoadingState label='Loading repair tasks...' />;
  if (!tasksQuery.data?.length)
    return (
      <EmptyState
        title='No repair tasks yet'
        body='Ingest a few documents or ask a low-confidence question to generate self-healing work.'
      />
    );

  return (
    <TaskList
      tasks={tasksQuery.data}
      onRun={async (id) => {
        await runMutation.mutateAsync(id);
      }}
      onIgnore={async (id) => {
        await ignoreMutation.mutateAsync(id);
      }}
    />
  );
}
