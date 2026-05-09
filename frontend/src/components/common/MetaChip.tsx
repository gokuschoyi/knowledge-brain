import { Badge, HStack, Text, type BadgeProps } from '@chakra-ui/react';

export function MetaChip({
  label,
  value,
  ...props
}: BadgeProps & { label?: string; value: string }) {
  return (
    <Badge
      variant='outline'
      borderRadius='full'
      px='2.5'
      py='1.5'
      borderColor='glassBorder'
      color='fgMuted'
      bg='rgba(8, 17, 33, 0.6)'
      {...props}
    >
      <HStack gap='1.5'>
        {label ? (
          <Text fontFamily='mono' fontSize='0.68rem' opacity={0.7}>
            {label}
          </Text>
        ) : null}
        <Text fontSize='0.75rem' color='fg'>
          {value}
        </Text>
      </HStack>
    </Badge>
  );
}
