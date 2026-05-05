import {
  Flex,
  Box,
  Heading,
  Text,
  Badge,
  HStack,
  Code,
} from '@chakra-ui/react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

export function TaskCard({
  task,
  onRun,
  onIgnore,
}: {
  task: any;
  onRun: (id: number) => Promise<void>;
  onIgnore: (id: number) => Promise<void>;
}) {
  return (
    <Card>
      <Flex mb='2' align='flex-start' justify='space-between' gap='3'>
        <Box>
          <Heading size='sm' color='white'>
            {task.title}
          </Heading>
          <Text mt='1' fontSize='sm' color='slate.400'>
            {task.description}
          </Text>
        </Box>
        <Badge
          size='sm'
          colorPalette={
            task.status === 'completed'
              ? 'green'
              : task.status === 'pending'
                ? 'orange'
                : 'blue'
          }
          textTransform='uppercase'
        >
          {task.status}
        </Badge>
      </Flex>

      <HStack mb='4' gap='2' fontSize='xs' color='slate.500'>
        <Text fontWeight='bold' color='slate.400' textTransform='uppercase'>
          {task.task_type}
        </Text>
        <Text>·</Text>
        <Text>Priority {task.priority}</Text>
      </HStack>

      {task.result && Object.keys(task.result).length > 0 && (
        <Box
          mb='4'
          p='3'
          bg='slate.900'
          borderRadius='md'
          borderWidth='1px'
          borderColor='slate.800'
          maxH='200px'
          overflow='auto'
        >
          <Code
            variant='plain'
            display='block'
            whiteSpace='pre-wrap'
            fontSize='xs'
            color='slate.300'
          >
            {JSON.stringify(task.result, null, 2)}
          </Code>
        </Box>
      )}

      <HStack gap='2'>
        <Button size='sm' onClick={() => onRun(task.id)}>
          Run Repair
        </Button>
        <Button
          size='sm'
          variant='outline'
          colorPalette='slate'
          onClick={() => onIgnore(task.id)}
        >
          Ignore
        </Button>
      </HStack>
    </Card>
  );
}
