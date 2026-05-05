import { FormEvent, useState } from 'react';
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

import { ChatResponse } from '../../api/chat';
import { Card } from '../common/Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { MessageBubble } from './MessageBubble';

export function ChatWindow({
  response,
  onSubmit,
  loading,
}: {
  response: ChatResponse | null;
  onSubmit: (question: string) => Promise<void>;
  loading: boolean;
}) {
  const [question, setQuestion] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    const currentQuestion = question;
    setQuestion('');
    await onSubmit(currentQuestion);
  }

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
      <Box flex='1' overflowY='auto' p={6}>
        <Stack gap='6' align='stretch'>
          {!response && !loading && (
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

          {response && (
            <>
              <MessageBubble role='assistant' content={response.answer} />
              <Flex align='center' gap='2' px='2'>
                <ConfidenceBadge score={response.confidence_score} />
                <Box h='px' flex='1' bg='slate.800' />
              </Flex>
            </>
          )}

          {loading && (
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
