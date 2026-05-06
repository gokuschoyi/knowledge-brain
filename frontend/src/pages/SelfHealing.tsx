import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Grid, Heading, Stack, Text, Portal } from '@chakra-ui/react';
import { Play } from 'lucide-react';

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
import { Tooltip } from '../components/ui/tooltip';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogActionTrigger,
} from '../components/ui/dialog';

export function SelfHealingPage() {
  const { activeBrainId } = useActiveBrain();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-healing'] });
      setIsConfirmDialogOpen(false);
    },
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
    <Stack gap='6' pb={6} h='full' minH='0' position='relative'>
      <Grid
        p={6}
        templateColumns={{ base: '1fr 1fr', xl: 'repeat(4, 1fr)' }}
        gap='4'
      >
        <Card px={4} py={3}>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Pending
          </Text>
          <Heading size='lg' color='orange.300'>
            {summary.pending}
          </Heading>
        </Card>
        <Card px={4} py={3}>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Running
          </Text>
          <Heading size='lg' color='blue.300'>
            {summary.running}
          </Heading>
        </Card>
        <Card px={4} py={3}>
          <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
            Completed
          </Text>
          <Heading size='lg' color='green.300'>
            {summary.completed}
          </Heading>
        </Card>
        <Card px={4} py={3}>
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
        <Box minH='0' overflowY='auto' pr='6'>
          <RepairResultPanel task={selectedTask} />
        </Box>
      </Grid>

      {/* Floating Action Button */}
      <Portal>
        <Box position='fixed' bottom='8' right='8' zIndex='1000'>
          <Tooltip content='Run all pending repair tasks' showArrow>
            <Button
              size='lg'
              height='14'
              width='14'
              rounded='full'
              boxShadow='0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)'
              onClick={() => setIsConfirmDialogOpen(true)}
              bg='brand.500'
              disabled={!summary.pending}
              _hover={{ bg: 'brand.400', transform: 'scale(1.05)' }}
              transition='all 0.2s'
            >
              <Play size={24} color='white' />
            </Button>
          </Tooltip>
        </Box>
      </Portal>

      {/* Confirmation Dialog */}
      <DialogRoot
        open={isConfirmDialogOpen}
        onOpenChange={(details) => setIsConfirmDialogOpen(details.open)}
        size='sm'
        placement='center'
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle color='white'>Confirm Repair Action</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text color='slate.300'>
              Are you sure you want to run all{' '}
              <strong>{summary.pending}</strong> pending self-healing tasks for{' '}
              <strong>{activeBrain.name}</strong>?
            </Text>
          </DialogBody>
          <DialogFooter gap='3'>
            <DialogActionTrigger asChild>
              <Button variant='outline'>Cancel</Button>
            </DialogActionTrigger>
            <Button
              onClick={() => runAllMutation.mutate()}
              loading={runAllMutation.isPending}
              bg='brand.500'
            >
              Run fixes
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </Stack>
  );
}
