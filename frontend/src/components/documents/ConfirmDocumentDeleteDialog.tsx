import { Text } from '@chakra-ui/react';

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
} from '../ui/dialog';

export function ConfirmDocumentDeleteDialog({
  documentTitle,
  isOpen,
  isDeleting,
  onConfirm,
  onOpenChange,
}: {
  documentTitle: string;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => onOpenChange(details.open)}
      size='sm'
      placement='center'
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle color='white'>Delete Document</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text color='slate.300'>
            Are you sure you want to delete <strong>{documentTitle}</strong>?
            This action cannot be undone.
          </Text>
        </DialogBody>
        <DialogFooter gap='3'>
          <DialogActionTrigger asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogActionTrigger>
          <Button colorPalette='red' onClick={onConfirm} loading={isDeleting}>
            Delete document
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
