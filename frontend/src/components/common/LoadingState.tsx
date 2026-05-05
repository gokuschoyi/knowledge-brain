import { Flex, Spinner, Text } from '@chakra-ui/react';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <Flex
      align='center'
      gap={3}
      p={4}
      borderRadius='md'
      border='1px'
      borderColor='slate.800'
      bg='slate.900'
    >
      <Spinner size='sm' color='brand.500' />
      <Text fontSize='sm' color='slate.400'>
        {label}
      </Text>
    </Flex>
  );
}
