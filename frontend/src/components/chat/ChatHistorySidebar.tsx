import { Box, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import { History } from 'lucide-react';

import type { ChatSession } from '../../api/types';
import { Button } from '../common/Button';
import { LoadingState } from '../common/LoadingState';
import { SessionItem } from './SessionItem';

type Props = {
  brainName: string;
  sessions: ChatSession[];
  activeSessionId: number | null;
  isLoading: boolean;
  isDisabled: boolean;
  onNewChat: () => void;
  onSelectSession: (id: number) => void;
};

export function ChatHistorySidebar({
  brainName,
  sessions,
  activeSessionId,
  isLoading,
  isDisabled,
  onNewChat,
  onSelectSession,
}: Props) {
  return (
    <Box
      flex='1'
      p='4'
      className='arctic-glass'
      borderRadius='2xl'
      overflow='hidden'
    >
      <Heading
        size='xs'
        color='slate.500'
        textTransform='uppercase'
        mb='4'
        display='flex'
        alignItems='center'
        justifyContent='space-between'
      >
        <Flex align='center' gap='2'>
          <History size={14} /> Recent Research
        </Flex>
        <Button
          size='xs'
          variant='outline'
          disabled={isDisabled}
          onClick={onNewChat}
        >
          New chat
        </Button>
      </Heading>
      <Text fontSize='xs' color='fgMuted' mb='4'>
        Showing saved chats for {brainName}.
      </Text>
      {isLoading ? (
        <LoadingState label='Loading history...' />
      ) : !sessions.length ? (
        <Flex
          direction='column'
          align='center'
          justify='center'
          h='40'
          opacity={0.4}
        >
          <Text fontSize='xs' textAlign='center'>
            No saved conversations yet
          </Text>
        </Flex>
      ) : (
        <Stack gap='2'>
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={onSelectSession}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
