import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Flex, Heading, Button, Stack, Text } from '@chakra-ui/react';
import { History } from 'lucide-react';

import { getBrains } from '../api/brains';
import { ChatWindow } from '../components/chat/ChatWindow';
import { SourcePanel } from '../components/chat/SourcePanel';
import { KnowledgeGapPanel } from '../components/chat/KnowledgeGapPanel';
import { LoadingState } from '../components/common/LoadingState';
import { Card } from '../components/common/Card';
import { useActiveBrain } from '../context/useActiveBrain';
import {
  getChatSession,
  getChatSessions,
  queryChatStreaming,
} from '../api/chat';
import type {
  ChatMessage,
  ChatResponse,
  ChatSource,
  JsonValue,
} from '../api/types';

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSourcesFromMessage(message: ChatMessage | null): ChatSource[] {
  if (!message) return [];

  return message.sources.flatMap((source) => {
    if (!isJsonObject(source)) return [];

    const documentId = source.document_id;
    const documentTitle = source.document_title;
    const chunkId = source.chunk_id;
    const snippet = source.snippet;

    if (
      typeof documentId !== 'number' ||
      typeof documentTitle !== 'string' ||
      typeof chunkId !== 'number' ||
      typeof snippet !== 'string'
    ) {
      return [];
    }

    return [
      {
        document_id: documentId,
        document_title: documentTitle,
        chunk_id: chunkId,
        snippet,
      },
    ];
  });
}

function readKnowledgeGapsFromMessage(message: ChatMessage | null): string[] {
  if (!message) return [];

  const gaps = message.metadata.knowledge_gaps;
  if (!Array.isArray(gaps)) return [];

  return gaps.filter((gap): gap is string => typeof gap === 'string');
}

type ChatUiState = {
  brainId: string;
  activeSessionId: number | null;
  isStartingNewChat: boolean;
  selectedAssistantMessageId: number | null;
  latestResponse: ChatResponse | null;
  pendingQuestion: string | null;
  streamingAnswer: string;
  loading: boolean;
};

function createChatUiState(brainId: string): ChatUiState {
  return {
    brainId,
    activeSessionId: null,
    isStartingNewChat: false,
    selectedAssistantMessageId: null,
    latestResponse: null,
    pendingQuestion: null,
    streamingAnswer: '',
    loading: false,
  };
}

export function ChatPage() {
  const { activeBrainId } = useActiveBrain();
  const [uiState, setUiState] = useState<ChatUiState>(() =>
    createChatUiState(activeBrainId),
  );
  const queryClient = useQueryClient();
  const scopedUiState =
    uiState.brainId === activeBrainId
      ? uiState
      : createChatUiState(activeBrainId);

  const brainsQuery = useQuery({ queryKey: ['brains'], queryFn: getBrains });
  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions', activeBrainId],
    queryFn: () => getChatSessions(activeBrainId),
    enabled: !!activeBrainId,
  });
  const activeSessionId =
    scopedUiState.activeSessionId ??
    (!scopedUiState.isStartingNewChat
      ? (sessionsQuery.data?.[0]?.id ?? null)
      : null);
  const activeSessionQuery = useQuery({
    queryKey: ['chat-session', activeSessionId],
    queryFn: () => getChatSession(activeSessionId as number),
    enabled: activeSessionId !== null,
  });
  const activeMessages = useMemo(
    () => activeSessionQuery.data?.messages ?? [],
    [activeSessionQuery.data?.messages],
  );
  const assistantMessages = useMemo(
    () => activeMessages.filter((message) => message.role === 'assistant'),
    [activeMessages],
  );
  const selectedAssistantMessage = useMemo(() => {
    if (!assistantMessages.length) return null;
    if (scopedUiState.selectedAssistantMessageId === null) {
      return assistantMessages[assistantMessages.length - 1] ?? null;
    }
    return (
      assistantMessages.find(
        (message) => message.id === scopedUiState.selectedAssistantMessageId,
      ) ??
      assistantMessages[assistantMessages.length - 1] ??
      null
    );
  }, [assistantMessages, scopedUiState.selectedAssistantMessageId]);

  const analysisSources = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? scopedUiState.latestResponse.sources
        : readSourcesFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const analysisGaps = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? scopedUiState.latestResponse.knowledge_gaps
        : readKnowledgeGapsFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );

  async function handleChat(question: string) {
    if (!activeBrainId) return;
    setUiState((current) => {
      const nextState =
        current.brainId === activeBrainId
          ? current
          : createChatUiState(activeBrainId);
      return {
        ...nextState,
        brainId: activeBrainId,
        loading: true,
        pendingQuestion: question,
        streamingAnswer: '',
      };
    });
    let nextSessionId = activeSessionId;
    try {
      await queryChatStreaming(
        question,
        activeSessionId,
        activeBrainId,
        (event) => {
          switch (event.type) {
            case 'token':
              setUiState((current) => {
                const nextState =
                  current.brainId === activeBrainId
                    ? current
                    : createChatUiState(activeBrainId);
                return {
                  ...nextState,
                  brainId: activeBrainId,
                  streamingAnswer: nextState.streamingAnswer + event.delta,
                };
              });
              return;
            case 'final':
              nextSessionId = event.payload.session_id;
              setUiState((current) => ({
                ...(current.brainId === activeBrainId
                  ? current
                  : createChatUiState(activeBrainId)),
                brainId: activeBrainId,
                activeSessionId: event.payload.session_id,
                isStartingNewChat: false,
                selectedAssistantMessageId: null,
                latestResponse: event.payload,
                streamingAnswer: '',
              }));
              queryClient.invalidateQueries({
                queryKey: ['chat-sessions', activeBrainId],
              });
              queryClient.invalidateQueries({
                queryKey: ['chat-session', event.payload.session_id],
              });
              return;
            case 'error':
              throw new Error(event.message || 'Streaming chat failed.');
            default:
              return;
          }
        },
      );
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      if (nextSessionId !== null) {
        await queryClient.invalidateQueries({
          queryKey: ['chat-session', nextSessionId],
        });
      }
      setUiState((current) => ({
        ...(current.brainId === activeBrainId
          ? current
          : createChatUiState(activeBrainId)),
        brainId: activeBrainId,
        loading: false,
        pendingQuestion: null,
      }));
    }
  }

  if (brainsQuery.isLoading)
    return <LoadingState label='Activating brains...' />;

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Card>
        <Text fontSize='sm' color='slate.400'>
          Select an active brain in the header to start chatting with its
          knowledge.
        </Text>
      </Card>
    );
  }

  return (
    <Flex h='100%' gap='6'>
      {/* Sidebar - History */}
      <Box w='80' pl={6} py={6} display={{ base: 'none', xl: 'block' }}>
        <Stack gap='6' h='full'>
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
              justifyContent='space-between'
            >
              <Flex align='center' gap='2'>
                <History size={14} /> Recent Research
              </Flex>
              <Button
                size='xs'
                variant='outline'
                borderColor='slate.700'
                color='slate.200'
                bg='slate.950'
                _hover={{ bg: 'slate.800' }}
                disabled={scopedUiState.loading}
                onClick={() => {
                  setUiState({
                    ...createChatUiState(activeBrainId),
                    brainId: activeBrainId,
                    isStartingNewChat: true,
                  });
                }}
              >
                New chat
              </Button>
            </Heading>
            <Text fontSize='xs' color='slate.500' mb='4'>
              Showing saved chats for {activeBrain.name}.
            </Text>
            {sessionsQuery.isLoading ? (
              <LoadingState label='Loading history...' />
            ) : !sessionsQuery.data?.length ? (
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
                {sessionsQuery.data.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <Button
                      key={session.id}
                      justifyContent='flex-start'
                      variant='ghost'
                      h='auto'
                      py='3'
                      px='3'
                      bg={isActive ? 'slate.800' : 'transparent'}
                      borderWidth='1px'
                      borderColor={isActive ? 'slate.700' : 'transparent'}
                      _hover={{ bg: 'slate.800' }}
                      onClick={() => {
                        setUiState({
                          ...createChatUiState(activeBrainId),
                          brainId: activeBrainId,
                          activeSessionId: session.id,
                        });
                      }}
                    >
                      <Stack gap='1' align='flex-start'>
                        <Text fontSize='sm' color='white' lineClamp={2}>
                          {session.title || 'Untitled conversation'}
                        </Text>
                        <Text fontSize='xs' color='slate.500'>
                          {new Date(session.created_at).toLocaleString()}
                        </Text>
                      </Stack>
                    </Button>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </Box>

      {/* Main Chat Area */}
      <Box flex='1' h='full' py={6}>
        <ChatWindow
          messages={activeMessages}
          pendingQuestion={scopedUiState.pendingQuestion}
          streamingAnswer={scopedUiState.streamingAnswer}
          selectedAssistantMessageId={selectedAssistantMessage?.id ?? null}
          onAssistantMessageSelect={(messageId) => {
            setUiState((current) => ({
              ...(current.brainId === activeBrainId
                ? current
                : createChatUiState(activeBrainId)),
              brainId: activeBrainId,
              selectedAssistantMessageId: messageId,
              latestResponse: null,
            }));
          }}
          onSubmit={handleChat}
          loading={scopedUiState.loading}
        />
      </Box>

      {/* Analysis Panel */}
      {(analysisGaps.length > 0 || analysisSources.length > 0) && (
        <Box w='80' pr={6} py={6} display={{ base: 'none', '2xl': 'block' }}>
          <Stack gap='6' h='full' overflowY='auto' px={2}>
            <KnowledgeGapPanel gaps={analysisGaps} />
            {analysisSources.length ? (
              <SourcePanel sources={analysisSources} />
            ) : null}
          </Stack>
        </Box>
      )}
    </Flex>
  );
}
