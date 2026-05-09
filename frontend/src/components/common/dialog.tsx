/* eslint-disable react-refresh/only-export-components */
import { Dialog as ChakraDialog, Portal } from '@chakra-ui/react';
import * as React from 'react';

import { CloseButton } from '../ui/close-button';

interface DialogContentProps extends ChakraDialog.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
  backdrop?: boolean;
}

export const DialogBackdrop = React.forwardRef<
  HTMLDivElement,
  ChakraDialog.BackdropProps
>(function DialogBackdrop(props, ref) {
  return (
    <ChakraDialog.Backdrop
      ref={ref}
      bg='rgba(3, 7, 18, 0.68)'
      backdropFilter='blur(10px)'
      {...props}
    />
  );
});

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props;

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {backdrop && <DialogBackdrop />}
      <ChakraDialog.Positioner px={{ base: 4, md: 6 }} py='6'>
        <ChakraDialog.Content
          ref={ref}
          asChild={false}
          bg='rgba(12, 21, 40, 0.94)'
          border='1px solid'
          borderColor='glassBorder'
          borderRadius='2xl'
          boxShadow='glass'
          backdropFilter='blur(24px)'
          overflow='hidden'
          color='fg'
          {...rest}
        >
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </Portal>
  );
});

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position='absolute'
      top='3'
      insetEnd='3'
      {...props}
      asChild
    >
      <CloseButton
        size='sm'
        ref={ref}
        bg='rgba(148, 163, 184, 0.08)'
        border='1px solid'
        borderColor='glassBorder'
        color='fgMuted'
        _hover={{ bg: 'rgba(148, 163, 184, 0.12)', color: 'white' }}
      >
        {props.children}
      </CloseButton>
    </ChakraDialog.CloseTrigger>
  );
});

export const DialogRoot = ChakraDialog.Root;
export const DialogFooter = ChakraDialog.Footer;
export const DialogHeader = ChakraDialog.Header;
export const DialogBody = ChakraDialog.Body;
export const DialogTitle = ChakraDialog.Title;
export const DialogDescription = ChakraDialog.Description;
export const DialogTrigger = ChakraDialog.Trigger;
export const DialogActionTrigger = ChakraDialog.ActionTrigger;
