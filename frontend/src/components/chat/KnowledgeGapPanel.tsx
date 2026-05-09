import { Heading, List } from '@chakra-ui/react';
import { Card } from '../common/Card';

export function KnowledgeGapPanel({ gaps }: { gaps: string[] }) {
  if (!gaps.length) return null;
  return (
    <Card variant='panel' shadow='none'>
      <Heading size='sm' color='white' mb='3'>
        Knowledge gaps
      </Heading>
      <List.Root gap='2' fontSize='sm' color='slate.300' ml='4'>
        {gaps.map((gap) => (
          <List.Item key={gap}>{gap}</List.Item>
        ))}
      </List.Root>
    </Card>
  );
}
