import { Badge, type BadgeProps } from '@chakra-ui/react';

const PALETTE_BY_STATUS: Record<string, string> = {
  pending: 'orange',
  processing: 'blue',
  running: 'blue',
  queued: 'yellow',
  completed: 'green',
  failed: 'red',
  ignored: 'gray',
};

export function StatusPill({
  status,
  children,
  ...props
}: BadgeProps & { status: string }) {
  return (
    <Badge
      colorPalette={PALETTE_BY_STATUS[status] ?? 'gray'}
      variant='subtle'
      borderRadius='full'
      px='2.5'
      py='1'
      textTransform='uppercase'
      letterSpacing='0.08em'
      fontSize='0.68rem'
      fontWeight='700'
      {...props}
    >
      {children ?? status}
    </Badge>
  );
}
