import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Heading,
  Stack,
  Text,
  Portal,
  Flex,
} from '@chakra-ui/react';
import { Filter, Play, RefreshCw, X } from 'lucide-react';

import {
  deleteSelfHealingTask,
  ignoreSelfHealingTask,
  listSelfHealingTasks,
  runAllSelfHealingTasks,
  runSelfHealingTask,
} from '../api/selfHealing';
import { getBrains, updateBrain } from '../api/brains';
import {
  AutoRepairSettingsDialog,
  type AutoRepairFormState,
} from '../components/common/AutoRepairSettingsDialog';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { TaskList } from '../components/selfHealing/TaskList';
import { RepairResultPanel } from '../components/selfHealing/RepairResultPanel';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useActiveBrain } from '../context/useActiveBrain';
import { Tooltip } from '../components/ui/tooltip';
import type { SelfHealingTask } from '../api/types';
import type { Brain } from '../api/brains';

const RUNNABLE_REPAIR_TYPES = [
  'missing_definition',
  'duplicate_entity',
  'low_confidence_answer',
  'contradiction',
] as const;

export function SelfHealingPage() {
  const { activeBrainId } = useActiveBrain();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isAutoRepairDialogOpen, setIsAutoRepairDialogOpen] = useState(false);
  const [activePolledTaskIds, setActivePolledTaskIds] = useState<number[]>([]);
  const [activeTaskTypeFilter, setActiveTaskTypeFilter] = useState<
    string | null
  >(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [selectionState, setSelectionState] = useState<{
    brainId: string;
    selectedTaskId: number | null;
  }>({
    brainId: activeBrainId,
    selectedTaskId: null,
  });
  const [autoRepairForm, setAutoRepairForm] =
    useState<AutoRepairFormState>(null);
  const queryClient = useQueryClient();
  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });
  const tasksQuery = useQuery({
    queryKey: ['self-healing', activeBrainId],
    queryFn: () => listSelfHealingTasks(activeBrainId || undefined),
    enabled: !!activeBrainId,
    refetchInterval: (query) => {
      const data = query.state.data as SelfHealingTask[];
      if (!data) return false;
      const hasRunning = data.some(
        (t) => t.status === 'running' || activePolledTaskIds.includes(t.id),
      );
      return hasRunning ? 2000 : false;
    },
  });
  const runMutation = useMutation({
    mutationFn: runSelfHealingTask,
    onSuccess: (response) => {
      setActivePolledTaskIds((current) =>
        current.includes(response.task_id)
          ? current
          : [...current, response.task_id],
      );
      queryClient.invalidateQueries({ queryKey: ['self-healing'] });
    },
  });
  const ignoreMutation = useMutation({
    mutationFn: ignoreSelfHealingTask,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['self-healing'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSelfHealingTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-healing'] });
      setPendingDeleteTask(null);
    },
  });
  const runAllMutation = useMutation({
    mutationFn: () => runAllSelfHealingTasks(activeBrainId || null),
    onSuccess: (response) => {
      setActivePolledTaskIds((current) => {
        const merged = new Set(current);
        response.queued_task_ids.forEach((id) => merged.add(id));
        return Array.from(merged);
      });
      queryClient.invalidateQueries({ queryKey: ['self-healing'] });
      setIsConfirmDialogOpen(false);
    },
  });
  const updateBrainMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      auto_repair_enabled: boolean;
      auto_repair_safe_only: boolean;
      auto_repair_allowed_types: string[];
      auto_repair_frequency_minutes: number;
    }) =>
      updateBrain(payload.id, {
        auto_repair_enabled: payload.auto_repair_enabled,
        auto_repair_safe_only: payload.auto_repair_safe_only,
        auto_repair_allowed_types: payload.auto_repair_allowed_types,
        auto_repair_frequency_minutes: payload.auto_repair_frequency_minutes,
      }),
    onSuccess: (brain) => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      syncAutoRepairForm(brain);
    },
  });

  const rawTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const taskTypes = useMemo(() => {
    const types = new Set(rawTasks.map((t) => t.task_type));
    return Array.from(types).sort();
  }, [rawTasks]);

  const tasks = useMemo(() => {
    let filtered = rawTasks;
    if (activeTaskTypeFilter) {
      filtered = filtered.filter((t) => t.task_type === activeTaskTypeFilter);
    }

    return [...filtered].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [rawTasks, activeTaskTypeFilter]);

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

  const activeTaskIdSet = useMemo(
    () => new Set(activePolledTaskIds),
    [activePolledTaskIds],
  );

  const finishedTaskIds = useMemo(() => {
    if (!activePolledTaskIds.length) return new Set<number>();
    return new Set(
      rawTasks
        .filter(
          (task) =>
            activeTaskIdSet.has(task.id) &&
            (task.status === 'completed' ||
              task.status === 'failed' ||
              task.status === 'ignored'),
        )
        .map((task) => task.id),
    );
  }, [activeTaskIdSet, rawTasks, activePolledTaskIds.length]);

  if (activeBrainId !== selectionState.brainId) {
    setSelectionState({ brainId: activeBrainId, selectedTaskId: null });
    setActivePolledTaskIds([]);
  }

  if (finishedTaskIds.size > 0) {
    setActivePolledTaskIds((current) =>
      current.filter((id) => !finishedTaskIds.has(id)),
    );
  }

  if (brainsQuery.isLoading || tasksQuery.isLoading)
    return <LoadingState label='Loading repair tasks...' />;

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  function syncAutoRepairForm(brain: Brain) {
    setAutoRepairForm({
      brainId: brain.id,
      enabled: brain.auto_repair_enabled,
      safeOnly: brain.auto_repair_safe_only,
      allowedTypes: brain.auto_repair_allowed_types ?? [],
      frequencyMinutes: String(brain.auto_repair_frequency_minutes ?? 60),
    });
  }

  if (
    activeBrain &&
    (!autoRepairForm || autoRepairForm.brainId !== activeBrain.id)
  ) {
    syncAutoRepairForm(activeBrain);
  }

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

  const frequencyOptions = [15, 30, 60, 120, 240, 1440];
  const parsedFrequency = Math.max(
    5,
    Number.parseInt(autoRepairForm?.frequencyMinutes || '60', 10) || 60,
  );
  const autoRepairDirty =
    !!autoRepairForm &&
    (autoRepairForm.enabled !== activeBrain.auto_repair_enabled ||
      autoRepairForm.safeOnly !== activeBrain.auto_repair_safe_only ||
      parsedFrequency !== activeBrain.auto_repair_frequency_minutes ||
      JSON.stringify(autoRepairForm.allowedTypes.slice().sort()) !==
        JSON.stringify(
          (activeBrain.auto_repair_allowed_types ?? []).slice().sort(),
        ));

  return (
    <Stack gap='6' h='full' minH='0' position='relative'>
      {tasks.length ? (
        <>
          <Grid
            px={6}
            pt={6}
            templateColumns={{ base: '1fr 1fr', xl: 'repeat(4, 1fr)' }}
            gap='4'
          >
            <Card variant='metric' px={4} py={3}>
              <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
                Pending
              </Text>
              <Heading size='lg' color='orange.300'>
                {summary.pending}
              </Heading>
            </Card>
            <Card variant='metric' px={4} py={3}>
              <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
                Running
              </Text>
              <Heading size='lg' color='blue.300'>
                {summary.running}
              </Heading>
            </Card>
            <Card variant='metric' px={4} py={3}>
              <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
                Completed
              </Text>
              <Heading size='lg' color='green.300'>
                {summary.completed}
              </Heading>
            </Card>
            <Card variant='metric' px={4} py={3}>
              <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
                Failed
              </Text>
              <Heading size='lg' color='red.300'>
                {summary.failed}
              </Heading>
            </Card>
          </Grid>

          {taskTypes.length > 0 && (
            <Flex px={6} gap='2' wrap='wrap' align='center'>
              <Flex align='center' gap='2' mr='2'>
                <Filter size={14} color='#64748b' />
                <Text
                  fontSize='xs'
                  fontWeight='bold'
                  color='slate.500'
                  textTransform='uppercase'
                  letterSpacing='wider'
                >
                  Filter by type
                </Text>
              </Flex>

              <Button
                size='xs'
                variant={activeTaskTypeFilter === null ? 'solid' : 'ghost'}
                onClick={() => setActiveTaskTypeFilter(null)}
                rounded='full'
                px='3'
              >
                All
              </Button>

              {taskTypes.map((type) => (
                <Button
                  key={type}
                  size='xs'
                  variant={activeTaskTypeFilter === type ? 'solid' : 'ghost'}
                  onClick={() => setActiveTaskTypeFilter(type)}
                  rounded='full'
                  px='3'
                  textTransform='capitalize'
                >
                  {type.split('_').join(' ')}
                </Button>
              ))}

              {activeTaskTypeFilter && (
                <Tooltip content='Clear filter'>
                  <Box
                    as='button'
                    onClick={() => setActiveTaskTypeFilter(null)}
                    p='1'
                    rounded='full'
                    _hover={{ bg: 'whiteAlpha.100' }}
                    color='slate.400'
                  >
                    <X size={14} />
                  </Box>
                </Tooltip>
              )}
            </Flex>
          )}
        </>
      ) : (
        <Box px={6} py={6}>
          <EmptyState
            title='No repair tasks for this brain'
            body='Ingest more material or ask low-confidence questions in this brain to generate self-healing work.'
          />
        </Box>
      )}

      {tasks.length ? (
        <Grid
          templateColumns={{ base: '1fr', xl: 'minmax(0, 1.2fr) 380px' }}
          gap='6'
          flex='1'
          minH='0'
          pb={6}
        >
          <Box minH='0' overflowY='auto' pr='1' pt={2}>
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
              onDelete={async (id) => {
                const task = tasks.find((item) => item.id === id);
                if (!task) return;
                setPendingDeleteTask({ id, title: task.title });
              }}
            />
          </Box>
          <Box
            minH='0'
            overflow='hidden'
            pr='6'
            pt={2}
            display='flex'
            flexDirection='column'
          >
            <RepairResultPanel task={selectedTask} />
          </Box>
        </Grid>
      ) : null}

      <ConfirmDialog
        title='Delete Repair Task'
        description={
          <>
            Are you sure you want to delete{' '}
            <strong>{pendingDeleteTask?.title ?? 'this repair task'}</strong>?
            This pending task will be removed from the repair queue.
          </>
        }
        confirmLabel='Delete task'
        isOpen={!!pendingDeleteTask}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteTask(null);
          }
        }}
        onConfirm={() => {
          if (!pendingDeleteTask) return;
          void deleteMutation.mutateAsync(pendingDeleteTask.id);
        }}
      />

      {/* Floating Action Button */}
      <Portal>
        <Box
          position='fixed'
          bottom='8'
          right='8'
          zIndex='1000'
          display='flex'
          flexDirection='column'
          gap='3'
        >
          <Tooltip content='Configure auto repair' showArrow>
            <Button
              size='lg'
              variant='floating'
              height='14'
              width='14'
              onClick={() => setIsAutoRepairDialogOpen(true)}
              bg={
                activeBrain.auto_repair_enabled
                  ? 'rgba(20, 184, 166, 0.2)'
                  : 'bgPanelElevated'
              }
              color={activeBrain.auto_repair_enabled ? 'white' : 'fgMuted'}
              border='1px solid'
              borderColor={
                activeBrain.auto_repair_enabled
                  ? 'rgba(20, 184, 166, 0.34)'
                  : 'glassBorder'
              }
              boxShadow='glass'
              backdropFilter='blur(18px)'
              _hover={{
                bg: activeBrain.auto_repair_enabled
                  ? 'rgba(20, 184, 166, 0.28)'
                  : 'rgba(148, 163, 184, 0.12)',
                borderColor: activeBrain.auto_repair_enabled
                  ? 'rgba(45, 212, 191, 0.44)'
                  : 'rgba(99, 102, 241, 0.28)',
                transform: 'translateY(-2px) scale(1.02)',
              }}
              transition='all 0.2s'
            >
              <RefreshCw size={22} />
            </Button>
          </Tooltip>

          <Tooltip content='Run all pending repair tasks' showArrow>
            <Button
              size='lg'
              variant='floating'
              height='14'
              width='14'
              onClick={() => setIsConfirmDialogOpen(true)}
              bg='rgba(99, 102, 241, 0.22)'
              color='white'
              border='1px solid'
              borderColor='borderStrong'
              boxShadow='glass'
              backdropFilter='blur(18px)'
              disabled={!summary.pending}
              _hover={{
                bg: 'rgba(99, 102, 241, 0.3)',
                borderColor: 'rgba(129, 140, 248, 0.5)',
                transform: 'translateY(-2px) scale(1.02)',
              }}
              _disabled={{
                bg: 'bgPanelElevated',
                color: 'fgSubtle',
                borderColor: 'glassBorder',
                boxShadow: 'none',
              }}
              transition='all 0.2s'
            >
              <Play size={24} />
            </Button>
          </Tooltip>
        </Box>
      </Portal>

      <AutoRepairSettingsDialog
        isOpen={isAutoRepairDialogOpen}
        activeBrain={activeBrain}
        form={autoRepairForm}
        parsedFrequency={parsedFrequency}
        frequencyOptions={frequencyOptions}
        runnableRepairTypes={RUNNABLE_REPAIR_TYPES}
        isDirty={autoRepairDirty}
        isSaving={updateBrainMutation.isPending}
        onOpenChange={(open) => {
          setIsAutoRepairDialogOpen(open);
          if (!open && activeBrain) syncAutoRepairForm(activeBrain);
        }}
        onFormChange={setAutoRepairForm}
        onSave={() => {
          if (!autoRepairForm) return;
          updateBrainMutation.mutate(
            {
              id: activeBrain.id,
              auto_repair_enabled: autoRepairForm.enabled,
              auto_repair_safe_only: autoRepairForm.safeOnly,
              auto_repair_allowed_types: autoRepairForm.allowedTypes,
              auto_repair_frequency_minutes: parsedFrequency,
            },
            {
              onSuccess: () => setIsAutoRepairDialogOpen(false),
            },
          );
        }}
      />

      <ConfirmDialog
        title='Confirm Repair Action'
        description={
          <>
            Are you sure you want to run all <strong>{summary.pending}</strong>{' '}
            pending self-healing tasks for <strong>{activeBrain.name}</strong>?
          </>
        }
        confirmLabel='Run fixes'
        confirmVariant='signal'
        isOpen={isConfirmDialogOpen}
        isDeleting={runAllMutation.isPending}
        onOpenChange={setIsConfirmDialogOpen}
        onConfirm={() => {
          void runAllMutation.mutate();
        }}
      />
    </Stack>
  );
}
