import { memo, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type {
  ChatAnswerSection,
  ChatSource,
  CitationCoverageStatus,
} from '../../api/types';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

function coverageLabel(
  citationCoverageStatus: CitationCoverageStatus | null | undefined,
): { label: string; tone: 'green' | 'yellow' | 'red' } | null {
  switch (citationCoverageStatus) {
    case 'well_supported':
      return { label: 'Well supported', tone: 'green' };
    case 'partially_supported':
      return { label: 'Partially supported', tone: 'yellow' };
    case 'needs_verification':
      return { label: 'Needs verification', tone: 'red' };
    default:
      return null;
  }
}

function deriveBubbleWarnings(
  knowledgeGaps: string[],
  contradictionWarnings: string[],
): string[] {
  const warnings = new Set<string>();
  if (contradictionWarnings.length) {
    warnings.add('Contradiction present');
  }
  if (knowledgeGaps.some((gap) => /precise value|exact value/i.test(gap))) {
    warnings.add('Missing exact value');
  }
  if (knowledgeGaps.some((gap) => /limited grounded evidence/i.test(gap))) {
    warnings.add('Limited coverage');
  }
  return Array.from(warnings);
}

export const MessageBubble = memo(
  ({
    role,
    content,
    active = false,
    confidenceScore,
    citationCoverageStatus = null,
    contradictionWarnings = [],
    knowledgeGaps = [],
    answerSections = [],
    evidenceItems = [],
    statusPill = null,
    thinking = false,
    onClick,
    onSourceClick,
  }: {
    role: 'user' | 'assistant';
    content: string;
    active?: boolean;
    confidenceScore?: number | null;
    citationCoverageStatus?: CitationCoverageStatus | null;
    contradictionWarnings?: string[];
    knowledgeGaps?: string[];
    answerSections?: ChatAnswerSection[];
    evidenceItems?: ChatSource[];
    statusPill?: {
      key: string;
      label: string;
      state: 'pending' | 'active' | 'complete';
    } | null;
    thinking?: boolean;
    onClick?: () => void;
    onSourceClick?: (source: ChatSource) => void;
  }) => {
    const isClickable = role === 'assistant' && !!onClick;
    const isLowConfidence =
      role === 'assistant' &&
      confidenceScore != null &&
      confidenceScore < LOW_CONFIDENCE_THRESHOLD;
    const [citationIndex, setCitationIndex] = useState(0);
    const supportState = coverageLabel(citationCoverageStatus);
    const bubbleWarnings = useMemo(
      () => deriveBubbleWarnings(knowledgeGaps, contradictionWarnings),
      [knowledgeGaps, contradictionWarnings],
    );
    const renderedSections =
      role === 'assistant' && answerSections.length
        ? answerSections
        : [{ content, citation_numbers: [] }];
    const shouldShowThinkingCopy =
      role === 'assistant' && thinking && !content.trim();

    return (
      <Flex
        justify={role === 'user' ? 'flex-end' : 'flex-start'}
        w='full'
        py={1}
      >
        <Box
          maxW='90%'
          minW='0'
          borderRadius='2xl'
          px={4}
          py={3}
          fontSize='sm'
          shadow='sm'
          bg={
            role === 'user'
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.88), rgba(79, 70, 229, 0.7))'
              : 'rgba(8, 17, 33, 0.9)'
          }
          color={role === 'user' ? 'white' : 'slate.100'}
          border='1px'
          borderColor={
            role === 'user' ? 'signal.500' : active ? 'cyan.400' : 'glassBorder'
          }
          borderTopLeftRadius={role === 'assistant' ? '0' : '2xl'}
          borderTopRightRadius={role === 'user' ? '0' : '2xl'}
          boxShadow={
            active
              ? '0 0 0 1px rgba(34, 211, 238, 0.55), 0 18px 34px rgba(34, 211, 238, 0.14)'
              : '0 18px 34px rgba(3, 7, 18, 0.22)'
          }
          cursor={isClickable ? 'pointer' : 'default'}
          transition='border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease'
          _hover={
            isClickable
              ? {
                  borderColor: 'cyan.400',
                  boxShadow: '0 0 0 1px rgba(34, 211, 238, 0.45)',
                }
              : undefined
          }
          onClick={
            isClickable
              ? () => {
                  if (window.getSelection()?.toString()) return;
                  onClick?.();
                }
              : undefined
          }
        >
          {role === 'assistant' && (supportState || bubbleWarnings.length) ? (
            <VStack align='stretch' gap={2} mb={3}>
              {supportState ? (
                <HStack gap={2} wrap='wrap'>
                  <Badge
                    borderRadius='full'
                    px={2}
                    py={1}
                    bg={
                      supportState.tone === 'green'
                        ? 'rgba(34, 197, 94, 0.16)'
                        : supportState.tone === 'yellow'
                          ? 'rgba(245, 158, 11, 0.16)'
                          : 'rgba(248, 113, 113, 0.16)'
                    }
                    color={
                      supportState.tone === 'green'
                        ? 'green.300'
                        : supportState.tone === 'yellow'
                          ? 'yellow.300'
                          : 'red.300'
                    }
                    border='1px solid'
                    borderColor='whiteAlpha.200'
                  >
                    {supportState.label}
                  </Badge>
                </HStack>
              ) : null}
              {bubbleWarnings.length ? (
                <HStack gap={2} wrap='wrap'>
                  {bubbleWarnings.map((warning) => (
                    <Badge
                      key={warning}
                      borderRadius='full'
                      px={2}
                      py={1}
                      bg='rgba(245, 158, 11, 0.16)'
                      color='yellow.300'
                      border='1px solid rgba(245, 158, 11, 0.28)'
                    >
                      {warning}
                    </Badge>
                  ))}
                </HStack>
              ) : null}
            </VStack>
          ) : null}

          <VStack align='stretch' gap={3}>
            {shouldShowThinkingCopy ? (
              <Text fontSize='sm' color='slate.300'>
                Thinking through your request...
              </Text>
            ) : null}
            {renderedSections.map((section, sectionIndex) => (
              <Box key={`${sectionIndex}-${section.content.slice(0, 24)}`}>
                <MarkdownRenderer content={section.content} />
                {role === 'assistant' && section.citation_numbers.length ? (
                  <HStack mt={2} gap={2} wrap='wrap'>
                    {section.citation_numbers.map((citationNumber) => {
                      const source = evidenceItems[citationNumber - 1];
                      if (!source) return null;
                      return (
                        <Button
                          key={`${sectionIndex}-${citationNumber}`}
                          type='button'
                          size='xs'
                          variant='ghost'
                          px={2}
                          minW='auto'
                          borderRadius='full'
                          border='1px solid'
                          borderColor='whiteAlpha.200'
                          onClick={(event) => {
                            event.stopPropagation();
                            onSourceClick?.(source);
                          }}
                        >
                          [{citationNumber}]
                        </Button>
                      );
                    })}
                  </HStack>
                ) : null}
              </Box>
            ))}
          </VStack>

          {role === 'assistant' && evidenceItems.length ? (
            <HStack mt={3} gap={2} wrap='wrap'>
              <Button
                type='button'
                size='xs'
                variant='ghost'
                onClick={(event) => {
                  event.stopPropagation();
                  if (evidenceItems[0]) {
                    setCitationIndex(0);
                    onSourceClick?.(evidenceItems[0]);
                  }
                }}
              >
                First evidence
              </Button>
              {evidenceItems.length > 1 ? (
                <Button
                  type='button'
                  size='xs'
                  variant='ghost'
                  onClick={(event) => {
                    event.stopPropagation();
                    const nextIndex =
                      (citationIndex + 1) % evidenceItems.length;
                    setCitationIndex(nextIndex);
                    onSourceClick?.(evidenceItems[nextIndex]);
                  }}
                >
                  Next evidence
                </Button>
              ) : null}
            </HStack>
          ) : null}

          {role === 'assistant' && statusPill ? (
            <HStack mt={3} justify='flex-start'>
              <Badge
                borderRadius='full'
                px={2}
                py={1}
                bg={
                  statusPill.state === 'complete'
                    ? 'rgba(34, 197, 94, 0.16)'
                    : statusPill.state === 'active'
                      ? 'rgba(99, 102, 241, 0.18)'
                      : 'rgba(148, 163, 184, 0.1)'
                }
                color={
                  statusPill.state === 'complete'
                    ? 'green.300'
                    : statusPill.state === 'active'
                      ? 'cyan.200'
                      : 'slate.400'
                }
                border='1px solid'
                borderColor={
                  statusPill.state === 'active'
                    ? 'rgba(99, 102, 241, 0.28)'
                    : 'whiteAlpha.200'
                }
              >
                {statusPill.label}
              </Badge>
            </HStack>
          ) : null}

          {isLowConfidence && (
            <Flex
              align='center'
              gap={1.5}
              mt={2}
              pt={2}
              borderTop='1px'
              borderColor='slate.700'
            >
              <AlertTriangle
                size={12}
                color='var(--chakra-colors-yellow-500)'
              />
              <Text fontSize='xs' color='yellow.500'>
                Limited source coverage — verify this answer
              </Text>
            </Flex>
          )}
        </Box>
      </Flex>
    );
  },
);

MessageBubble.displayName = 'MessageBubble';
