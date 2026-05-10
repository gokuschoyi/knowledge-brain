import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Grid, Stack, Text } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

import {
  attachSelfHealingEvidence,
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
import { SelfHealingMetrics } from '../components/selfHealing/SelfHealingMetrics';
import { TaskTypeFilterBar } from '../components/selfHealing/TaskTypeFilterBar';
import { SelfHealingFab } from '../components/selfHealing/SelfHealingFab';
import {
  EvidenceUploadDialog,
  type EvidenceUploadValue,
} from '../components/selfHealing/EvidenceUploadDialog';
import { Card } from '../components/common/Card';
import { useActiveBrain } from '../context/useActiveBrain';
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
  const location = useLocation();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isAutoRepairDialogOpen, setIsAutoRepairDialogOpen] = useState(false);
  const [evidenceDialogTask, setEvidenceDialogTask] =
    useState<SelfHealingTask | null>(null);
  const [lastEvidenceMessage, setLastEvidenceMessage] = useState<string | null>(
    null,
  );
  const [activePolledTaskIds, setActivePolledTaskIds] = useState<number[]>([]);
  const [activeTaskTypeFilter, setActiveTaskTypeFilter] = useState<
    string | null
  >(() => new URLSearchParams(location.search).get('task_type'));
  const relatedEntityIdFilter = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('related_entity_id');
    return raw ? Number(raw) : null;
  }, [location.search]);

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
    queryKey: [
      'self-healing',
      activeBrainId,
      activeTaskTypeFilter,
      relatedEntityIdFilter,
    ],
    queryFn: () =>
      listSelfHealingTasks(activeBrainId || undefined, {
        taskType: activeTaskTypeFilter,
        relatedEntityId: relatedEntityIdFilter,
      }),
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
  const attachEvidenceMutation = useMutation({
    mutationFn: ({
      taskId,
      value,
    }: {
      taskId: number;
      value: EvidenceUploadValue;
    }) => {
      const payload = new FormData();
      payload.append('title', value.title);
      payload.append('source_type', value.sourceType);
      payload.append('source_authority', value.sourceAuthority);
      payload.append('rerun_task', String(value.rerunTask));
      if (value.sourceType === 'text') {
        payload.append('raw_text', value.rawText);
      } else if (value.sourceType === 'url') {
        payload.append('url', value.url);
      } else if (value.sourceType === 'file' && value.file) {
        payload.append('raw_file', value.file);
      }
      return attachSelfHealingEvidence(taskId, payload);
    },
    onSuccess: (response) => {
      setLastEvidenceMessage(
        `Evidence queued as document #${response.document_id}. Re-run the task after ingestion completes for the new evidence to be considered.`,
      );
      setEvidenceDialogTask(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
    return [...rawTasks].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [rawTasks]);

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
      resolved: tasks.filter((task) => task.status === 'resolved').length,
      unresolved: tasks.filter((task) => task.status === 'unresolved').length,
      reviewRequired: tasks.filter((task) => task.status === 'review_required')
        .length,
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
            (task.status === 'resolved' ||
              task.status === 'unresolved' ||
              task.status === 'review_required' ||
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
          {lastEvidenceMessage ? (
            <Box px={6} pt={6}>
              <Card variant='panel'>
                <Text fontSize='sm' color='slate.300'>
                  {lastEvidenceMessage}
                </Text>
              </Card>
            </Box>
          ) : null}
          <Box px={6} pt={6}>
            <SelfHealingMetrics summary={summary} />
          </Box>

          <Box px={6}>
            <TaskTypeFilterBar
              taskTypes={taskTypes}
              activeFilter={activeTaskTypeFilter}
              onFilterChange={setActiveTaskTypeFilter}
            />
          </Box>
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
              onAddEvidence={(task) => {
                setEvidenceDialogTask(task);
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

      <EvidenceUploadDialog
        isOpen={!!evidenceDialogTask}
        task={evidenceDialogTask}
        isSubmitting={attachEvidenceMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setEvidenceDialogTask(null);
        }}
        onSubmit={async (value) => {
          if (!evidenceDialogTask) return;
          await attachEvidenceMutation.mutateAsync({
            taskId: evidenceDialogTask.id,
            value,
          });
        }}
      />

      <SelfHealingFab
        autoRepairEnabled={activeBrain.auto_repair_enabled}
        pendingCount={summary.pending}
        onOpenSettings={() => setIsAutoRepairDialogOpen(true)}
        onRunAll={() => setIsConfirmDialogOpen(true)}
      />

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
