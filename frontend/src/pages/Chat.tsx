import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Flex, Stack, Text } from '@chakra-ui/react';

import { getBrains } from '../api/brains';
import { listDocuments } from '../api/documents';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatHistorySidebar } from '../components/chat/ChatHistorySidebar';
import { AnswerProofPanel } from '../components/chat/AnswerProofPanel';
import { SourceDrawer } from '../components/chat/SourceDrawer';
import { LoadingState } from '../components/common/LoadingState';
import { Card } from '../components/common/Card';
import { useActiveBrain } from '../context/useActiveBrain';
import {
  getChatSession,
  getChatSessions,
  queryChatStreaming,
} from '../api/chat';
import type {
  ChatAnswerSection,
  ChatMessage,
  ChatResponse,
  ChatSource,
  CitationCoverageStatus,
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
    const quoteText = source.quote_text;
    const evidenceSpanId = source.evidence_span_id;
    const fallbackText =
      typeof quoteText === 'string'
        ? quoteText
        : typeof snippet === 'string'
          ? snippet
          : null;

    if (
      typeof documentId !== 'number' ||
      typeof documentTitle !== 'string' ||
      fallbackText === null
    ) {
      return [];
    }

    return [
      {
        document_id: documentId,
        document_title: documentTitle,
        chunk_id: typeof chunkId === 'number' ? chunkId : undefined,
        evidence_span_id:
          typeof evidenceSpanId === 'number' ? evidenceSpanId : undefined,
        snippet: typeof snippet === 'string' ? snippet : undefined,
        quote_text: fallbackText,
        review_status:
          typeof source.review_status === 'string'
            ? source.review_status
            : null,
        file_extension:
          typeof source.file_extension === 'string'
            ? source.file_extension
            : null,
        page_number:
          typeof source.page_number === 'number' ? source.page_number : null,
        location_label:
          typeof source.location_label === 'string'
            ? source.location_label
            : null,
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

function readContradictionWarningsFromMessage(
  message: ChatMessage | null,
): string[] {
  if (!message) return [];

  const warnings = message.metadata.contradiction_warnings;
  if (!Array.isArray(warnings)) return [];

  return warnings.filter(
    (warning): warning is string => typeof warning === 'string',
  );
}

function readIntentFromMessage(message: ChatMessage | null): string | null {
  if (!message) return null;
  return typeof message.metadata.intent === 'string'
    ? message.metadata.intent
    : null;
}

function readSupportSummaryFromMessage(
  message: ChatMessage | null,
): string | null {
  if (!message) return null;
  return typeof message.metadata.support_summary === 'string'
    ? message.metadata.support_summary
    : null;
}

function readCitationCoverageStatusFromMessage(
  message: ChatMessage | null,
): CitationCoverageStatus | null {
  if (!message) return null;
  const status = message.metadata.citation_coverage_status;
  return status === 'well_supported' ||
    status === 'partially_supported' ||
    status === 'needs_verification'
    ? status
    : null;
}

function readNumberMetadata(
  message: ChatMessage | null,
  key: 'valid_citation_count' | 'rejected_citation_count',
): number | null {
  if (!message) return null;
  const value = message.metadata[key];
  return typeof value === 'number' ? value : null;
}

function readAnswerSectionsFromMessage(
  message: ChatMessage | null,
): ChatAnswerSection[] {
  if (!message) return [];
  const sections = message.metadata.answer_sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!isJsonObject(section)) return [];
    const content = section.content;
    const citationNumbers = section.citation_numbers;
    if (typeof content !== 'string' || !Array.isArray(citationNumbers)) {
      return [];
    }
    const validCitationNumbers = citationNumbers.filter(
      (value): value is number => typeof value === 'number',
    );
    return [{ content, citation_numbers: validCitationNumbers }];
  });
}

function readRelatedEntitiesFromMessage(
  message: ChatMessage | null,
): ChatResponse['related_entities'] {
  if (!message) return [];

  const entities = message.metadata.related_entities;
  if (!Array.isArray(entities)) return [];

  return entities.flatMap((entity) => {
    if (!isJsonObject(entity)) return [];
    const id = entity.id;
    const name = entity.name;
    const type = entity.type;
    if (
      typeof id !== 'number' ||
      typeof name !== 'string' ||
      typeof type !== 'string'
    ) {
      return [];
    }
    return [{ id, name, type }];
  });
}

type ChatUiState = {
  brainId: string;
  activeSessionId: number | null;
  isStartingNewChat: boolean;
  selectedAssistantMessageId: number | null;
  latestResponse: ChatResponse | null;
  pendingQuestion: string | null;
  streamingAnswer: string;
  streamingResponse: ChatResponse | null;
  streamingStage:
    | 'searching_knowledge'
    | 'generating_answer'
    | 'grounding_citations'
    | 'saving_response'
    | null;
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
    streamingResponse: null,
    streamingStage: null,
    loading: false,
  };
}

export function ChatPage() {
  const { activeBrainId } = useActiveBrain();
  const [uiState, setUiState] = useState<ChatUiState>(() =>
    createChatUiState(activeBrainId),
  );
  const [drawerSource, setDrawerSource] = useState<ChatSource | null>(null);
  const queryClient = useQueryClient();
  const scopedUiState =
    uiState.brainId === activeBrainId
      ? uiState
      : createChatUiState(activeBrainId);

  const brainsQuery = useQuery({ queryKey: ['brains'], queryFn: getBrains });
  const documentsQuery = useQuery({
    queryKey: ['documents', activeBrainId],
    queryFn: () => listDocuments(activeBrainId || undefined),
    enabled: !!activeBrainId,
  });
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
  const contradictionWarnings = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.contradiction_warnings ?? [])
        : readContradictionWarningsFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const answerIntent = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.intent ?? null)
        : readIntentFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const supportSummary = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.support_summary ?? null)
        : readSupportSummaryFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const relatedEntities = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? scopedUiState.latestResponse.related_entities
        : readRelatedEntitiesFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const citationCoverageStatus = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.citation_coverage_status ?? null)
        : readCitationCoverageStatusFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const validCitationCount = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.valid_citation_count ?? null)
        : readNumberMetadata(selectedAssistantMessage, 'valid_citation_count'),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const rejectedCitationCount = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.rejected_citation_count ?? null)
        : readNumberMetadata(
            selectedAssistantMessage,
            'rejected_citation_count',
          ),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const answerSections = useMemo(
    () =>
      scopedUiState.latestResponse?.session_id === activeSessionId &&
      selectedAssistantMessage === null
        ? (scopedUiState.latestResponse.answer_sections ?? [])
        : readAnswerSectionsFromMessage(selectedAssistantMessage),
    [activeSessionId, scopedUiState.latestResponse, selectedAssistantMessage],
  );
  const proofConfidenceScore =
    scopedUiState.latestResponse?.session_id === activeSessionId &&
    selectedAssistantMessage === null
      ? scopedUiState.latestResponse.confidence_score
      : (selectedAssistantMessage?.confidence_score ?? null);
  const shouldShowProofPanel =
    proofConfidenceScore != null ||
    !!supportSummary ||
    !!answerIntent ||
    !!analysisGaps.length ||
    !!contradictionWarnings.length ||
    !!relatedEntities.length ||
    !!analysisSources.length ||
    !!citationCoverageStatus ||
    !!answerSections.length;

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
        streamingResponse: null,
        streamingStage: 'searching_knowledge',
      };
    });
    let nextSessionId = activeSessionId;
    let didComplete = false;
    try {
      await queryChatStreaming(
        question,
        activeSessionId,
        activeBrainId,
        (event) => {
          switch (event.type) {
            case 'status':
              setUiState((current) => {
                const nextState =
                  current.brainId === activeBrainId
                    ? current
                    : createChatUiState(activeBrainId);
                return {
                  ...nextState,
                  brainId: activeBrainId,
                  streamingStage: event.stage,
                };
              });
              return;
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
                  streamingStage:
                    nextState.streamingStage ?? 'generating_answer',
                };
              });
              return;
            case 'citations':
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
                streamingResponse: event.payload,
                streamingStage: 'saving_response',
              }));
              queryClient.invalidateQueries({
                queryKey: ['chat-sessions', activeBrainId],
              });
              return;
            case 'complete':
              didComplete = true;
              nextSessionId = event.payload.session_id;
              setUiState((current) => {
                const nextState =
                  current.brainId === activeBrainId
                    ? current
                    : createChatUiState(activeBrainId);
                return {
                  ...nextState,
                  brainId: activeBrainId,
                  activeSessionId: event.payload.session_id,
                  isStartingNewChat: false,
                  selectedAssistantMessageId: null,
                  latestResponse:
                    nextState.streamingResponse ?? nextState.latestResponse,
                  streamingAnswer: '',
                  streamingResponse: null,
                  streamingStage: null,
                  loading: false,
                  pendingQuestion: null,
                };
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
      if (!didComplete) {
        setUiState((current) => ({
          ...(current.brainId === activeBrainId
            ? current
            : createChatUiState(activeBrainId)),
          brainId: activeBrainId,
          loading: false,
          pendingQuestion: null,
          streamingStage: null,
        }));
      }
    }
  }

  if (brainsQuery.isLoading)
    return <LoadingState label='Activating brains...' />;

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  if (!activeBrain) {
    return (
      <Box p={6}>
        <Card>
          <Text fontSize='sm' color='slate.400'>
            Select an active brain in the header to start chatting with its
            knowledge.
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Flex h='100%' gap='6'>
      {/* Sidebar - History */}
      <Box w='80' pl={6} py={6} display={{ base: 'none', xl: 'block' }}>
        <Stack gap='6' h='full'>
          <ChatHistorySidebar
            brainName={activeBrain.name}
            sessions={sessionsQuery.data ?? []}
            activeSessionId={activeSessionId}
            isLoading={sessionsQuery.isLoading}
            isDisabled={scopedUiState.loading}
            onNewChat={() => {
              setUiState({
                ...createChatUiState(activeBrainId),
                brainId: activeBrainId,
                isStartingNewChat: true,
              });
            }}
            onSelectSession={(id) => {
              setUiState({
                ...createChatUiState(activeBrainId),
                brainId: activeBrainId,
                activeSessionId: id,
              });
            }}
          />
        </Stack>
      </Box>

      {/* Main Chat Area */}
      <Box
        flex='1'
        h='full'
        py={6}
        pr={analysisGaps.length > 0 || analysisSources.length > 0 ? 0 : 6}
      >
        <ChatWindow
          messages={activeMessages}
          hasDocuments={(documentsQuery.data?.length ?? 0) > 0}
          pendingQuestion={scopedUiState.pendingQuestion}
          streamingAnswer={scopedUiState.streamingAnswer}
          streamingResponse={scopedUiState.streamingResponse}
          streamingStage={scopedUiState.streamingStage}
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
          onSourceClick={setDrawerSource}
          onSubmit={handleChat}
          loading={scopedUiState.loading}
        />
      </Box>

      {/* Analysis Panel */}
      {(analysisGaps.length > 0 || analysisSources.length > 0) && (
        <Box w='80' pr={6} py={6} display={{ base: 'none', '2xl': 'block' }}>
          <Stack gap='6' h='full' overflowY='auto'>
            {shouldShowProofPanel ? (
              <AnswerProofPanel
                confidenceScore={proofConfidenceScore}
                intent={answerIntent}
                supportSummary={supportSummary}
                knowledgeGaps={analysisGaps}
                contradictionWarnings={contradictionWarnings}
                relatedEntities={relatedEntities}
                evidenceItems={analysisSources}
                citationCoverageStatus={citationCoverageStatus}
                validCitationCount={validCitationCount}
                rejectedCitationCount={rejectedCitationCount}
                onSourceClick={setDrawerSource}
              />
            ) : null}
          </Stack>
        </Box>
      )}

      <SourceDrawer
        source={drawerSource}
        isOpen={drawerSource !== null}
        onClose={() => setDrawerSource(null)}
      />
    </Flex>
  );
}
