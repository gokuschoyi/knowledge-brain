import { Flex, Heading, Text } from '@chakra-ui/react';
import { Card } from './Card';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card p={8}>
      <Flex direction='column' align='center' textAlign='center'>
        <Heading size='md' color='white' mb={2}>
          {title}
        </Heading>
        <Text fontSize='sm' color='slate.400'>
          {body}
        </Text>
      </Flex>
    </Card>
  );
}
