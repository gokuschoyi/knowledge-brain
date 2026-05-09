import { Stack, Text } from '@chakra-ui/react';

import type { ChatSession } from '../../api/types';
import { Button } from '../common/Button';
import { MetaChip } from '../common/MetaChip';

type Props = {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: number) => void;
};

export function SessionItem({ session, isActive, onSelect }: Props) {
  return (
    <Button
      justifyContent='flex-start'
      variant='ghost'
      h='auto'
      py='2'
      px='3'
      bg={isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent'}
      borderWidth='1px'
      borderColor={isActive ? 'cyan.400' : 'transparent'}
      _hover={{ bg: 'rgba(255,255,255,0.06)' }}
      borderRadius='xl'
      onClick={() => onSelect(session.id)}
    >
      <Stack gap='1' align='flex-start' textAlign='start'>
        <Text fontSize='sm' color='white' lineClamp={2}>
          {session.title || 'Untitled conversation'}
        </Text>
        <MetaChip
          label='last'
          value={new Date(
            session.last_message_at ?? session.created_at,
          ).toLocaleString()}
        />
      </Stack>
    </Button>
  );
}
