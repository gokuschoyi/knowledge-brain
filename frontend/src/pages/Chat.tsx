import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
  NativeSelect,
} from '@chakra-ui/react';
import { Brain, History } from 'lucide-react';

import { getBrains } from '../api/brains';
import { ChatWindow } from '../components/chat/ChatWindow';
import { SourcePanel } from '../components/chat/SourcePanel';
import { KnowledgeGapPanel } from '../components/chat/KnowledgeGapPanel';
import { LoadingState } from '../components/common/LoadingState';
import { ChatResponse } from '../api/chat';

export function ChatPage() {
  const [selectedBrainId, setSelectedBrainId] = useState<string>('');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const brainsQuery = useQuery({ queryKey: ['brains'], queryFn: getBrains });

  async function handleChat(question: string) {
    if (!selectedBrainId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brain_id: selectedBrainId,
          message: question,
        }),
      });
      const data = await response.json();
      setChatResponse(data);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (brainsQuery.isLoading)
    return <LoadingState label='Activating brains...' />;

  return (
    <Flex h='calc(100vh - 120px)' gap='6'>
      {/* Sidebar - History & Brains */}
      <Box w='80' display={{ base: 'none', xl: 'block' }}>
        <Stack gap='6' h='full'>
          {/* Brain Selection */}
          <Box
            p='4'
            bg='slate.900'
            borderRadius='xl'
            borderWidth='1px'
            borderColor='slate.800'
          >
            <Heading
              size='xs'
              color='slate.500'
              textTransform='uppercase'
              mb='4'
              display='flex'
              alignItems='center'
              gap='2'
            >
              <Brain size={14} /> Active Brain
            </Heading>
            <NativeSelect.Root>
              <NativeSelect.Field
                bg='slate.950'
                borderColor='slate.800'
                value={selectedBrainId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedBrainId(e.target.value)
                }
              >
                <option value=''>Select a brain...</option>
                {brainsQuery.data?.map((brain) => (
                  <option key={brain.id} value={brain.id}>
                    {brain.name}
                  </option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Box>

          {/* History Placeholder */}
          <Box
            flex='1'
            p='4'
            bg='slate.900'
            borderRadius='xl'
            borderWidth='1px'
            borderColor='slate.800'
            overflow='hidden'
          >
            <Heading
              size='xs'
              color='slate.500'
              textTransform='uppercase'
              mb='4'
              display='flex'
              alignItems='center'
              gap='2'
            >
              <History size={14} /> Recent Research
            </Heading>
            <Flex
              direction='column'
              align='center'
              justify='center'
              h='40'
              opacity={0.3}
            >
              <Text fontSize='xs' textAlign='center'>
                History persistence coming soon
              </Text>
            </Flex>
          </Box>
        </Stack>
      </Box>

      {/* Main Chat Area */}
      <Box flex='1' h='full'>
        <ChatWindow
          response={chatResponse}
          onSubmit={handleChat}
          loading={loading}
        />
      </Box>

      {/* Analysis Panel */}
      {chatResponse && (
        <Box w='80' display={{ base: 'none', '2xl': 'block' }}>
          <Stack gap='6' h='full' overflowY='auto'>
            <KnowledgeGapPanel gaps={chatResponse.knowledge_gaps} />
            <SourcePanel sources={chatResponse.sources} />
          </Stack>
        </Box>
      )}
    </Flex>
  );
}
