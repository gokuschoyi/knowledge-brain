import { ChangeEvent, useState } from 'react';
import {
  Checkbox,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';

import { Button } from '../common/Button';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../common/dialog';
import { Field } from '../ui/field';
import type { SelfHealingTask } from '../../api/types';

export type EvidenceUploadValue = {
  title: string;
  sourceType: 'text' | 'file' | 'url';
  rawText: string;
  url: string;
  file: File | null;
  sourceAuthority: 'unknown' | 'user_provided' | 'secondary' | 'primary';
  rerunTask: boolean;
};

const DEFAULT_VALUE: EvidenceUploadValue = {
  title: '',
  sourceType: 'text',
  rawText: '',
  url: '',
  file: null,
  sourceAuthority: 'user_provided',
  rerunTask: false,
};

export function EvidenceUploadDialog({
  isOpen,
  task,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  isOpen: boolean;
  task: SelfHealingTask | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: EvidenceUploadValue) => Promise<void>;
}) {
  const [value, setValue] = useState<EvidenceUploadValue>(DEFAULT_VALUE);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setValue((current) => ({
      ...current,
      file: event.target.files?.[0] ?? null,
    }));
  }

  function resetAndClose() {
    setValue(DEFAULT_VALUE);
    onOpenChange(false);
  }

  async function handleSubmit() {
    const nextTitle =
      value.title.trim() ||
      `Evidence for ${task?.task_type === 'contradiction' ? 'contradiction' : 'low-confidence'} task #${task?.id ?? ''}`;
    await onSubmit({ ...value, title: nextTitle });
    setValue(DEFAULT_VALUE);
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => onOpenChange(details.open)}
      size='lg'
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle color='white'>
            {task?.task_type === 'contradiction'
              ? 'Attach clarifying source'
              : 'Add evidence'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap='4'>
            <Text fontSize='sm' color='slate.400'>
              This will create a normal ingestion job inside the active brain so
              the task can be reviewed again with stronger evidence.
            </Text>

            <Field label='Title'>
              <Input
                value={value.title}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder='Optional evidence title'
              />
            </Field>

            <Field label='Source type'>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={value.sourceType}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      sourceType: event.target
                        .value as EvidenceUploadValue['sourceType'],
                    }))
                  }
                >
                  <option value='text'>Raw Text</option>
                  <option value='file'>File Upload</option>
                  <option value='url'>Remote URL</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Field>

            <Field label='Source authority'>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={value.sourceAuthority}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      sourceAuthority: event.target
                        .value as EvidenceUploadValue['sourceAuthority'],
                    }))
                  }
                >
                  <option value='user_provided'>User provided</option>
                  <option value='secondary'>Secondary source</option>
                  <option value='primary'>Primary source</option>
                  <option value='unknown'>Unknown</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Field>

            {value.sourceType === 'text' ? (
              <Field label='Evidence text'>
                <Textarea
                  minH='180px'
                  value={value.rawText}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      rawText: event.target.value,
                    }))
                  }
                  placeholder='Paste the missing or clarifying evidence here'
                />
              </Field>
            ) : null}

            {value.sourceType === 'url' ? (
              <Field label='Evidence URL'>
                <Input
                  value={value.url}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder='https://example.com/source'
                />
              </Field>
            ) : null}

            {value.sourceType === 'file' ? (
              <Field label='Evidence file'>
                <Input type='file' onChange={handleFileChange} />
              </Field>
            ) : null}

            <Checkbox.Root
              checked={value.rerunTask}
              onCheckedChange={(details) =>
                setValue((current) => ({
                  ...current,
                  rerunTask: details.checked === true,
                }))
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label color='white'>
                Suggest rerunning this task after ingestion
              </Checkbox.Label>
            </Checkbox.Root>
          </Stack>
        </DialogBody>
        <DialogFooter gap='3'>
          <DialogActionTrigger asChild>
            <Button variant='outline' onClick={resetAndClose}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button onClick={handleSubmit} loading={isSubmitting}>
            Create evidence ingest
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
