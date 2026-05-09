import { Checkbox, NativeSelect, Stack, Text } from '@chakra-ui/react';

import type { Brain } from '../../api/brains';
import { Button } from './Button';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from './dialog';
import { Field } from '../ui/field';

export type AutoRepairFormState = {
  brainId: string;
  enabled: boolean;
  safeOnly: boolean;
  allowedTypes: string[];
  frequencyMinutes: string;
} | null;

export function AutoRepairSettingsDialog({
  isOpen,
  activeBrain,
  form,
  parsedFrequency,
  frequencyOptions,
  runnableRepairTypes,
  isDirty,
  isSaving,
  onOpenChange,
  onFormChange,
  onSave,
}: {
  isOpen: boolean;
  activeBrain: Brain;
  form: AutoRepairFormState;
  parsedFrequency: number;
  frequencyOptions: number[];
  runnableRepairTypes: readonly string[];
  isDirty: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (
    updater: (current: AutoRepairFormState) => AutoRepairFormState,
  ) => void;
  onSave: () => void;
}) {
  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => onOpenChange(details.open)}
      size='md'
      placement='center'
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle color='white'>Auto Repair Settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap='5'>
            <Text fontSize='sm' color='slate.400'>
              Configure scheduled self-healing for{' '}
              <strong>{activeBrain.name}</strong>.
            </Text>

            <Checkbox.Root
              checked={!!form?.enabled}
              onCheckedChange={(details) =>
                onFormChange((current) =>
                  current
                    ? { ...current, enabled: details.checked === true }
                    : current,
                )
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label color='white'>Enable auto repair</Checkbox.Label>
            </Checkbox.Root>

            <Checkbox.Root
              checked={!!form?.safeOnly}
              disabled={!form?.enabled}
              onCheckedChange={(details) =>
                onFormChange((current) =>
                  current
                    ? { ...current, safeOnly: details.checked === true }
                    : current,
                )
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label color='white'>Safe repairs only</Checkbox.Label>
            </Checkbox.Root>

            {form?.enabled && !form?.safeOnly && (
              <Stack gap='2' pl='1'>
                <Text fontSize='sm' color='white'>
                  Repair types to run
                </Text>
                <Text fontSize='xs' color='slate.500'>
                  Leave all unchecked to run every available type.
                </Text>
                {runnableRepairTypes.map((type) => (
                  <Checkbox.Root
                    key={type}
                    checked={form.allowedTypes.includes(type)}
                    onCheckedChange={(details) =>
                      onFormChange((current) =>
                        current
                          ? {
                              ...current,
                              allowedTypes:
                                details.checked === true
                                  ? [...current.allowedTypes, type]
                                  : current.allowedTypes.filter(
                                      (item) => item !== type,
                                    ),
                            }
                          : current,
                      )
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color='white' textTransform='capitalize'>
                      {type.split('_').join(' ')}
                    </Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </Stack>
            )}

            <Field
              label='Repair frequency'
              helperText='How often scheduled auto-repair should run.'
            >
              <NativeSelect.Root disabled={!form?.enabled}>
                <NativeSelect.Field
                  value={form?.frequencyMinutes ?? '60'}
                  onChange={(event) =>
                    onFormChange((current) =>
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

            <Stack gap='1'>
              <Text fontSize='xs' color='slate.500'>
                {activeBrain.last_auto_repair_at
                  ? `Last auto-repair run: ${new Date(activeBrain.last_auto_repair_at).toLocaleString()}`
                  : 'No auto-repair run has been recorded yet.'}
              </Text>
              <Text fontSize='xs' color='slate.500'>
                {form?.enabled
                  ? `Scheduled for every ${parsedFrequency} minute${parsedFrequency === 1 ? '' : 's'}.`
                  : 'Automatic repair is currently disabled.'}
              </Text>
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter gap='3'>
          <DialogActionTrigger asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogActionTrigger>
          <Button onClick={onSave} loading={isSaving} disabled={!isDirty}>
            Save auto-repair
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
