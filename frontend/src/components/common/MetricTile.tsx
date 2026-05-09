import { Box, HStack, Heading, Text, type BoxProps } from '@chakra-ui/react';

export function MetricTile({
  label,
  value,
  hint,
  accent,
  ...props
}: BoxProps & {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <Box
      className='arctic-glass ui-hover'
      borderRadius='2xl'
      px='5'
      py='5'
      position='relative'
      overflow='hidden'
      {...props}
    >
      <HStack justify='space-between' align='flex-start'>
        <Text textStyle='sectionLabel'>{label}</Text>
        {accent ? (
          <Box
            h='2.5'
            w='12'
            borderRadius='full'
            bg={accent}
            boxShadow={`0 0 28px ${accent}`}
            opacity={0.9}
          />
        ) : null}
      </HStack>
      <Heading mt='5' textStyle='statValue' color='white'>
        {value}
      </Heading>
      {hint ? (
        <Text mt='3' fontSize='sm' color='fgMuted'>
          {hint}
        </Text>
      ) : null}
    </Box>
  );
}
