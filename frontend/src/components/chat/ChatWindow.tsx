import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Alert,
  Box,
  Flex,
  Input,
  IconButton,
  Icon,
  Text,
  Stack,
  HStack,
} from '@chakra-ui/react';
import { Send, MessageSquare } from 'lucide-react';

import type {
  ChatAnswerSection,
  ChatMessage,
  ChatResponse,
  ChatSource,
  CitationCoverageStatus,
  JsonValue,
} from '../../api/types';
import { Card } from '../common/Card';
import { MetaChip } from '../common/MetaChip';
import { MessageBubble } from './MessageBubble';

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAnswerSections(message: ChatMessage): ChatAnswerSection[] {
  const sections = message.metadata.answer_sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!isJsonObject(section)) return [];
    if (
      typeof section.content !== 'string' ||
      !Array.isArray(section.citation_numbers)
    ) {
      return [];
    }
    return [
      {
        content: section.content,
        citation_numbers: section.citation_numbers.filter(
          (value): value is number => typeof value === 'number',
        ),
      },
    ];
  });
}

function readCitationCoverageStatus(
  message: ChatMessage,
): CitationCoverageStatus | null {
  const status = message.metadata.citation_coverage_status;
  return status === 'well_supported' ||
    status === 'partially_supported' ||
    status === 'needs_verification'
    ? status
    : null;
}

function readStringList(
  message: ChatMessage,
  key: 'knowledge_gaps' | 'contradiction_warnings',
): string[] {
  const value = message.metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readSources(message: ChatMessage): ChatSource[] {
  return message.sources.flatMap((source) => {
    if (!isJsonObject(source)) return [];
    if (
      typeof source.document_id !== 'number' ||
      typeof source.document_title !== 'string'
    ) {
      return [];
    }
    const quoteText =
      typeof source.quote_text === 'string'
        ? source.quote_text
        : typeof source.snippet === 'string'
          ? source.snippet
          : null;
    if (!quoteText) return [];
    return [
      {
        document_id: source.document_id,
        document_title: source.document_title,
        evidence_span_id:
          typeof source.evidence_span_id === 'number'
            ? source.evidence_span_id
            : undefined,
        quote_text: quoteText,
        snippet:
          typeof source.snippet === 'string' ? source.snippet : undefined,
        file_extension:
          typeof source.file_extension === 'string'
            ? source.file_extension
            : null,
        page_number:
          typeof source.page_number === 'number' ? source.page_number : null,
        review_status:
          typeof source.review_status === 'string'
            ? source.review_status
            : null,
        location_label:
          typeof source.location_label === 'string'
            ? source.location_label
            : null,
      },
    ];
  });
}

export function ChatWindow({
  messages,
  hasDocuments,
  pendingQuestion,
  streamingAnswer,
  streamingResponse,
  streamingStage,
  selectedAssistantMessageId,
  onAssistantMessageSelect,
  onSourceClick,
  onSubmit,
  loading,
}: {
  messages: ChatMessage[];
  hasDocuments: boolean;
  pendingQuestion: string | null;
  streamingAnswer: string;
  streamingResponse: ChatResponse | null;
  streamingStage:
    | 'searching_knowledge'
    | 'generating_answer'
    | 'grounding_citations'
    | 'saving_response'
    | null;
  selectedAssistantMessageId: number | null;
  onAssistantMessageSelect: (messageId: number) => void;
  onSourceClick: (source: ChatSource) => void;
  onSubmit: (question: string) => Promise<void>;
  loading: boolean;
}) {
  const [question, setQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const statusPills = useMemo(
    () =>
      [
        { key: 'searching_knowledge', label: 'Search knowledge' },
        { key: 'generating_answer', label: 'Generate answer' },
        { key: 'grounding_citations', label: 'Ground citations' },
        { key: 'saving_response', label: 'Save response' },
      ].map((pill, index, pills) => {
        const activeIndex = streamingStage
          ? pills.findIndex((item) => item.key === streamingStage)
          : -1;
        const state: 'pending' | 'active' | 'complete' =
          activeIndex === -1
            ? 'pending'
            : index < activeIndex
              ? 'complete'
              : index === activeIndex
                ? 'active'
                : 'pending';
        return { ...pill, state };
      }),
    [streamingStage],
  );
  const currentStatusPill = useMemo(
    () =>
      streamingStage
        ? (statusPills.find((pill) => pill.key === streamingStage) ?? null)
        : null,
    [statusPills, streamingStage],
  );

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
        citationCoverageStatus={
          message.role === 'assistant'
            ? readCitationCoverageStatus(message)
            : null
        }
        contradictionWarnings={
          message.role === 'assistant'
            ? readStringList(message, 'contradiction_warnings')
            : []
        }
        knowledgeGaps={
          message.role === 'assistant'
            ? readStringList(message, 'knowledge_gaps')
            : []
        }
        answerSections={
          message.role === 'assistant' ? readAnswerSections(message) : []
        }
        evidenceItems={message.role === 'assistant' ? readSources(message) : []}
        onClick={
          message.role === 'assistant'
            ? () => handleAssistantMessageSelect(message.id)
            : undefined
        }
        onSourceClick={message.role === 'assistant' ? onSourceClick : undefined}
      />
    ));
  }, [
    messages,
    selectedAssistantMessageId,
    handleAssistantMessageSelect,
    onSourceClick,
  ]);

  return (
    <Card
      variant='panel'
      display='flex'
      flexDirection='column'
      h='full'
      p={0}
      overflow='hidden'
    >
      <Box px='6' py='4' borderBottom='1px solid' borderColor='whiteAlpha.100'>
        <Stack gap='3'>
          <HStack justify='flex-end' gap='3' wrap='wrap'>
            <HStack gap='2'>
              <MetaChip label='messages' value={String(messages.length)} />
            </HStack>
          </HStack>

          {!hasDocuments ? (
            <Alert.Root
              status='warning'
              borderRadius='xl'
              bg='rgba(245, 158, 11, 0.12)'
              border='1px solid'
              borderColor='rgba(245, 158, 11, 0.28)'
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>No documents uploaded yet</Alert.Title>
                <Alert.Description>
                  Upload documents to this brain before relying on chat
                  responses. Without source material, answers may be limited.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
          ) : null}
        </Stack>
      </Box>

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

          {loading ? (
            <MessageBubble
              role='assistant'
              content={streamingAnswer || streamingResponse?.answer || ''}
              confidenceScore={streamingResponse?.confidence_score ?? null}
              citationCoverageStatus={
                streamingResponse?.citation_coverage_status ?? null
              }
              contradictionWarnings={
                streamingResponse?.contradiction_warnings ?? []
              }
              knowledgeGaps={streamingResponse?.knowledge_gaps ?? []}
              answerSections={streamingResponse?.answer_sections ?? []}
              evidenceItems={streamingResponse?.sources ?? []}
              statusPill={currentStatusPill}
              thinking
              onSourceClick={onSourceClick}
            />
          ) : null}
        </Stack>
      </Box>

      <Box
        p={4}
        borderTop='1px solid'
        borderColor='whiteAlpha.100'
        bg='rgba(8, 17, 33, 0.72)'
      >
        <form onSubmit={handleSubmit}>
          <Flex
            gap='2'
            className='arctic-glass'
            borderRadius='2xl'
            p='2'
            align='center'
          >
            <Input
              placeholder='Ask the active brain for intelligence...'
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
              disabled={loading || !question.trim()}
              type='submit'
              borderRadius='xl'
              bg='signal.500'
              color='white'
              _hover={{ bg: 'signal.400' }}
            >
              <Send size={16} />
            </IconButton>
          </Flex>
        </form>
      </Box>
    </Card>
  );
}
