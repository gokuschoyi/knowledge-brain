import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Checkbox,
  Grid,
  Heading,
  NativeSelect,
  Stack,
  Text,
  Portal,
  Flex,
} from '@chakra-ui/react';
import { Filter, Play, X } from 'lucide-react';

import {
  ignoreSelfHealingTask,
  listSelfHealingTasks,
  runAllSelfHealingTasks,
  runSelfHealingTask,
} from '../api/selfHealing';
import { getBrains, updateBrain } from '../api/brains';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { TaskList } from '../components/selfHealing/TaskList';
import { RepairResultPanel } from '../components/selfHealing/RepairResultPanel';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useActiveBrain } from '../context/useActiveBrain';
import { Tooltip } from '../components/ui/tooltip';
import { Field } from '../components/ui/field';
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
import type { SelfHealingTask } from '../api/types';
import type { Brain } from '../api/brains';

export function SelfHealingPage() {
  const { activeBrainId } = useActiveBrain();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [activePolledTaskIds, setActivePolledTaskIds] = useState<number[]>([]);
  const [activeTaskTypeFilter, setActiveTaskTypeFilter] = useState<
    string | null
  >(null);
  const [selectionState, setSelectionState] = useState<{
    brainId: string;
    selectedTaskId: number | null;
  }>({
    brainId: activeBrainId,
    selectedTaskId: null,
  });
  const [autoRepairForm, setAutoRepairForm] = useState<{
    brainId: string;
    enabled: boolean;
    safeOnly: boolean;
    frequencyMinutes: string;
  } | null>(null);
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
      auto_repair_frequency_minutes: number;
    }) =>
      updateBrain(payload.id, {
        auto_repair_enabled: payload.auto_repair_enabled,
        auto_repair_safe_only: payload.auto_repair_safe_only,
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
      parsedFrequency !== activeBrain.auto_repair_frequency_minutes);

  return (
    <Stack gap='6' pb={6} h='full' minH='0' position='relative'>
      <Box px={6} pt={6}>
        <Card p={5}>
          <Stack gap='4'>
            <Flex justify='space-between' align='start' gap='4' wrap='wrap'>
              <Box>
                <Heading size='sm' color='white'>
                  Auto Repair
                </Heading>
                <Text fontSize='sm' color='slate.400' mt='1'>
                  Run safe self-healing tasks for this brain on a schedule.
                </Text>
              </Box>
              <Button
                onClick={() => {
                  if (!autoRepairForm) return;
                  updateBrainMutation.mutate({
                    id: activeBrain.id,
                    auto_repair_enabled: autoRepairForm.enabled,
                    auto_repair_safe_only: autoRepairForm.safeOnly,
                    auto_repair_frequency_minutes: parsedFrequency,
                  });
                }}
                loading={updateBrainMutation.isPending}
                disabled={!autoRepairDirty}
              >
                Save auto-repair
              </Button>
            </Flex>

            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }} gap='4'>
              <Card px={4} py={3} bg='transparent'>
                <Stack gap='3'>
                  <Checkbox.Root
                    checked={!!autoRepairForm?.enabled}
                    onCheckedChange={(details) =>
                      setAutoRepairForm((current) =>
                        current
                          ? {
                              ...current,
                              enabled: details.checked === true,
                            }
                          : current,
                      )
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color='white'>
                      Enable auto repair
                    </Checkbox.Label>
                  </Checkbox.Root>
                  <Text fontSize='xs' color='slate.500'>
                    Turns on scheduled repair runs for this brain.
                  </Text>
                </Stack>
              </Card>

              <Card px={4} py={3} bg='transparent'>
                <Stack gap='3'>
                  <Checkbox.Root
                    checked={!!autoRepairForm?.safeOnly}
                    disabled={!autoRepairForm?.enabled}
                    onCheckedChange={(details) =>
                      setAutoRepairForm((current) =>
                        current
                          ? {
                              ...current,
                              safeOnly: details.checked === true,
                            }
                          : current,
                      )
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color='white'>
                      Safe repairs only
                    </Checkbox.Label>
                  </Checkbox.Root>
                  <Text fontSize='xs' color='slate.500'>
                    Keeps automatic runs limited to low-risk repair types.
                  </Text>
                </Stack>
              </Card>

              <Card px={4} py={3} bg='transparent'>
                <Field
                  label='Repair frequency'
                  helperText='How often scheduled auto-repair should run.'
                >
                  <NativeSelect.Root disabled={!autoRepairForm?.enabled}>
                    <NativeSelect.Field
                      value={autoRepairForm?.frequencyMinutes ?? '60'}
                      onChange={(event) =>
                        setAutoRepairForm((current) =>
                          current
                            ? {
                                ...current,
                                frequencyMinutes: event.target.value,
                              }
                            : current,
                        )
                      }
                    >
                      {frequencyOptions.map((minutes) => (
                        <option key={minutes} value={String(minutes)}>
                          {minutes < 60
                            ? `Every ${minutes} minutes`
                            : minutes === 60
                              ? 'Every hour'
                              : minutes < 1440
                                ? `Every ${minutes / 60} hours`
                                : 'Every day'}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field>
              </Card>
            </Grid>

            <Flex justify='space-between' align='center' gap='4' wrap='wrap'>
              <Text fontSize='xs' color='slate.500'>
                {activeBrain.last_auto_repair_at
                  ? `Last auto-repair run: ${new Date(activeBrain.last_auto_repair_at).toLocaleString()}`
                  : 'No auto-repair run has been recorded yet.'}
              </Text>
              {autoRepairForm?.enabled ? (
                <Text fontSize='xs' color='slate.400'>
                  Scheduled for every {parsedFrequency} minute
                  {parsedFrequency === 1 ? '' : 's'}.
                </Text>
              ) : (
                <Text fontSize='xs' color='slate.500'>
                  Automatic repair is currently disabled.
                </Text>
              )}
            </Flex>
          </Stack>
        </Card>
      </Box>

      {tasks.length ? (
        <>
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
        <Box px={6} pb={6}>
          <EmptyState
            title='No repair tasks for this brain'
            body='Ingest more material or ask low-confidence questions in this brain to generate self-healing work.'
          />
        </Box>
      )}

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
