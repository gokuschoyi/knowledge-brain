import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Flex, Grid, Heading, Stack, Text } from '@chakra-ui/react';

import {
  ignoreSelfHealingTask,
  listSelfHealingTasks,
  runAllSelfHealingTasks,
  runSelfHealingTask,
} from '../api/selfHealing';
import { getBrains } from '../api/brains';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { TaskList } from '../components/selfHealing/TaskList';
import { RepairResultPanel } from '../components/selfHealing/RepairResultPanel';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useActiveBrain } from '../context/useActiveBrain';

export function SelfHealingPage() {
  const { activeBrainId } = useActiveBrain();
  const [selectionState, setSelectionState] = useState<{
    brainId: string;
    selectedTaskId: number | null;
  }>({
    brainId: activeBrainId,
    selectedTaskId: null,
  });
  const queryClient = useQueryClient();
  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });
  const tasksQuery = useQuery({
    queryKey: ['self-healing', activeBrainId],
    queryFn: () => listSelfHealingTasks(activeBrainId || undefined),
    enabled: !!activeBrainId,
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
  const runAllMutation = useMutation({
    mutationFn: () => runAllSelfHealingTasks(activeBrainId || null),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['self-healing'] }),
  });
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const selectedTaskId =
    selectionState.brainId === activeBrainId
      ? selectionState.selectedTaskId
      : null;
  const selectedTask = useMemo(() => {
    if (!tasks.length) return null;
    if (selectedTaskId === null) {
      return tasks[0] ?? null;
    }
    return tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;
  }, [selectedTaskId, tasks]);

  const summary = useMemo(
    () => ({
      pending: tasks.filter((task) => task.status === 'pending').length,
      running: tasks.filter((task) => task.status === 'running').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
    }),
    [tasks],
  );

  if (brainsQuery.isLoading || tasksQuery.isLoading)
    return <LoadingState label='Loading repair tasks...' />;

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Box p={6}>
        <Card>
          <Text fontSize='sm' color='slate.400'>
            Select an active brain in the header to review its self-healing
            queue.
          </Text>
        </Card>
      </Box>
    );
  }

  if (!tasks.length)
    return (
      <Stack gap='6' h='full' minH='0' p={6}>
        <EmptyState
          title='No repair tasks for this brain'
          body='Ingest more material or ask low-confidence questions in this brain to generate self-healing work.'
        />
      </Stack>
    );

  return (
    <Stack gap='6' h='full' minH='0' p={6}>
      <Flex align='flex-start' justify='space-between' gap='4' wrap='wrap'>
        <Box>
          <Heading size='lg' color='white'>
            Self Healing
          </Heading>
          <Text fontSize='sm' color='slate.400'>
            Review repair work for {activeBrain.name} and run only the fixes you
            trust.
          </Text>
        </Box>
        <Flex gap='3' wrap='wrap'>
          <Button
            onClick={() => runAllMutation.mutate()}
            loading={runAllMutation.isPending}
            disabled={!summary.pending}
          >
            Run all pending
          </Button>
        </Flex>
      </Flex>

      <Grid templateColumns={{ base: '1fr 1fr', xl: 'repeat(4, 1fr)' }} gap='4'>
        <Card>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Pending
          </Text>
          <Heading size='lg' color='orange.300'>
            {summary.pending}
          </Heading>
        </Card>
        <Card>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Running
          </Text>
          <Heading size='lg' color='blue.300'>
            {summary.running}
          </Heading>
        </Card>
        <Card>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Completed
          </Text>
          <Heading size='lg' color='green.300'>
            {summary.completed}
          </Heading>
        </Card>
        <Card>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Failed
          </Text>
          <Heading size='lg' color='red.300'>
            {summary.failed}
          </Heading>
        </Card>
      </Grid>

      <Grid
        templateColumns={{ base: '1fr', xl: 'minmax(0, 1.2fr) 380px' }}
        gap='6'
        flex='1'
        minH='0'
      >
        <Box minH='0' overflowY='auto' pr='1'>
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTask?.id ?? null}
            onSelect={(taskId) => {
              setSelectionState({
                brainId: activeBrainId,
                selectedTaskId: taskId,
              });
            }}
            onRun={async (id) => {
              await runMutation.mutateAsync(id);
            }}
            onIgnore={async (id) => {
              await ignoreMutation.mutateAsync(id);
            }}
          />
        </Box>
        <Box minH='0' overflowY='auto' pr='1'>
          <RepairResultPanel task={selectedTask} />
        </Box>
      </Grid>
    </Stack>
  );
}
