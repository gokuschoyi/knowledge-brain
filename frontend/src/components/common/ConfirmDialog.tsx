import type * as React from 'react';

import { Text } from '@chakra-ui/react';

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

export function ConfirmDialog({
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  isOpen,
  isLoading,
  isDeleting,
  onConfirm,
  onOpenChange,
  confirmVariant = 'danger',
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isOpen: boolean;
  isLoading?: boolean;
  isDeleting?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  confirmVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const loading = isLoading ?? isDeleting ?? false;

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => onOpenChange(details.open)}
      size='sm'
      placement='center'
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle color='white'>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {children ?? (
            <Text fontSize='sm' color='slate.300'>
              {description}
            </Text>
          )}
        </DialogBody>
        <DialogFooter gap='3'>
          <DialogActionTrigger asChild>
            <Button variant='outline'>{cancelLabel}</Button>
          </DialogActionTrigger>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
