import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Flex,
  Input,
  IconButton,
  Icon,
  Text,
  Spinner,
  Stack,
} from '@chakra-ui/react';
import { Send, MessageSquare } from 'lucide-react';

import type { ChatMessage } from '../../api/types';
import { Card } from '../common/Card';
import { MessageBubble } from './MessageBubble';

export function ChatWindow({
  messages,
  pendingQuestion,
  streamingAnswer,
  selectedAssistantMessageId,
  onAssistantMessageSelect,
  onSubmit,
  loading,
}: {
  messages: ChatMessage[];
  pendingQuestion: string | null;
  streamingAnswer: string;
  selectedAssistantMessageId: number | null;
  onAssistantMessageSelect: (messageId: number) => void;
  onSubmit: (question: string) => Promise<void>;
  loading: boolean;
}) {
  const [question, setQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Memoize the callback to prevent child re-renders
  const handleAssistantMessageSelect = useCallback(
    (id: number) => {
      onAssistantMessageSelect(id);
    },
    [onAssistantMessageSelect],
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, pendingQuestion, streamingAnswer, loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    const currentQuestion = question;
    setQuestion('');
    await onSubmit(currentQuestion);
  }

  // Memoize the list of static messages
  const renderedMessages = useMemo(() => {
    return messages.map((message) => (
      <MessageBubble
        key={message.id}
        role={message.role}
        content={message.content}
        active={
          message.role === 'assistant' &&
          message.id === selectedAssistantMessageId
        }
        confidenceScore={message.confidence_score}
        onClick={
          message.role === 'assistant'
            ? () => handleAssistantMessageSelect(message.id)
            : undefined
        }
      />
    ));
  }, [messages, selectedAssistantMessageId, handleAssistantMessageSelect]);

  return (
    <Card
      display='flex'
      flexDirection='column'
      h='full'
      bg='slate.950'
      borderColor='slate.800'
      p={0}
      overflow='hidden'
    >
      <Box ref={scrollRef} flex='1' overflowY='auto' p={6}>
        <Stack gap='6' align='stretch'>
          {!messages.length && !pendingQuestion && !loading && (
            <Flex
              direction='column'
              h='full'
              align='center'
              justify='center'
              py={20}
              opacity={0.5}
            >
              <Icon as={MessageSquare} h='12' w='12' mb='4' />
              <Text fontSize='sm' fontStyle='italic' textAlign='center'>
                Select a brain and start a conversation.
              </Text>
            </Flex>
          )}

          {renderedMessages}

          {pendingQuestion ? (
            <MessageBubble role='user' content={pendingQuestion} />
          ) : null}

          {streamingAnswer ? (
            <MessageBubble role='assistant' content={streamingAnswer} />
          ) : null}

          {loading && !streamingAnswer && (
            <Flex direction='column' gap='4'>
              <Box
                bg='slate.800'
                h='10'
                w='full'
                borderRadius='2xl'
                borderTopLeftRadius='0'
              />
              <Spinner size='sm' color='brand.500' />
            </Flex>
          )}
        </Stack>
      </Box>

      <Box p={4} borderTop='1px' borderColor='slate.800' bg='slate.900'>
        <form onSubmit={handleSubmit}>
          <Flex
            gap='2'
            bg='slate.950'
            borderRadius='xl'
            border='1px'
            borderColor='slate.700'
            p='1.5'
          >
            <Input
              placeholder='Ask anything...'
              variant='flushed'
              border='none'
              px='3'
              py='2'
              fontSize='sm'
              color='slate.200'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <IconButton
              aria-label='Send message'
              colorPalette='brand'
              disabled={loading || !question.trim()}
              type='submit'
              borderRadius='lg'
            >
              {loading ? <Spinner size='xs' /> : <Send size={16} />}
            </IconButton>
          </Flex>
        </form>
      </Box>
    </Card>
  );
}
