import { Save } from 'lucide-react';
import { HStack, Input, Stack, Text, Textarea } from '@chakra-ui/react';

import { Button } from './Button';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from './dialog';
import { Field } from '../ui/field';

export function BrainEditorDialog({
  isOpen,
  editing,
  formData,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onOpenChange,
  onSubmit,
  onCancel,
}: {
  isOpen: boolean;
  editing: boolean;
  formData: { name: string; description: string };
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => {
        onOpenChange(details.open);
        if (!details.open) onCancel();
      }}
      size='md'
      placement='center'
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle color='white'>
            {editing ? 'Edit Knowledge Brain' : 'Create New Knowledge Brain'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap='4'>
            <Field label='Name'>
              <Input
                autoFocus
                value={formData.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder='Marketing Docs, Project X...'
                bg='slate.950'
                borderColor='slate.700'
              />
            </Field>
            <Field label='Description'>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder='Specify what kind of knowledge this brain handles...'
                bg='slate.950'
                borderColor='slate.700'
              />
            </Field>
          </Stack>
        </DialogBody>
        <DialogFooter gap='3'>
          <Button variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isSaving}>
            <HStack gap='2'>
              <Save size={16} />
              <Text>Save Brain</Text>
            </HStack>
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
