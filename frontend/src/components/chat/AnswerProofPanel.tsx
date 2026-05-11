import { Badge, Box, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import type {
  ChatRelatedEntity,
  ChatSource,
  CitationCoverageStatus,
} from '../../api/types';
import { Card } from '../common/Card';
import { MetaChip } from '../common/MetaChip';

function getConfidenceLabel(confidenceScore: number | null): {
  label: string;
  tone: 'green' | 'yellow' | 'red';
} {
  if (confidenceScore == null) {
    return { label: 'Unknown', tone: 'yellow' };
  }
  if (confidenceScore >= 0.8) {
    return { label: 'Strong', tone: 'green' };
  }
  if (confidenceScore >= 0.6) {
    return { label: 'Moderate', tone: 'yellow' };
  }
  return { label: 'Weak', tone: 'red' };
}

function deriveWarnings(
  confidenceScore: number | null,
  knowledgeGaps: string[],
  contradictionWarnings: string[],
): string[] {
  const warnings = new Set<string>();

  if (confidenceScore != null && confidenceScore < 0.6) {
    warnings.add('Low Confidence');
  }
  if (contradictionWarnings.length) {
    warnings.add('Contradiction Present');
  }
  if (knowledgeGaps.some((gap) => /precise value|exact value/i.test(gap))) {
    warnings.add('Missing Exact Value');
  }
  if (knowledgeGaps.some((gap) => /limited grounded evidence/i.test(gap))) {
    warnings.add('Limited Coverage');
  }
  if (knowledgeGaps.some((gap) => /no strongly matching entities/i.test(gap))) {
    warnings.add('No Matching Entities');
  }

  return Array.from(warnings);
}

function reviewStatusLabel(
  reviewStatus: string | null | undefined,
): string | null {
  switch (reviewStatus) {
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    case 'needs_review':
      return 'Needs Review';
    case 'unreviewed':
      return 'Unreviewed';
    default:
      return null;
  }
}

export function AnswerProofPanel({
  confidenceScore,
  intent,
  supportSummary,
  knowledgeGaps,
  contradictionWarnings,
  relatedEntities,
  evidenceItems,
  citationCoverageStatus,
  validCitationCount,
  rejectedCitationCount,
  onSourceClick,
}: {
  confidenceScore: number | null;
  intent: string | null;
  supportSummary: string | null;
  knowledgeGaps: string[];
  contradictionWarnings: string[];
  relatedEntities: ChatRelatedEntity[];
  evidenceItems: ChatSource[];
  citationCoverageStatus: CitationCoverageStatus | null;
  validCitationCount: number | null;
  rejectedCitationCount: number | null;
  onSourceClick?: (source: ChatSource) => void;
}) {
  const confidence = getConfidenceLabel(confidenceScore);
  const warnings = deriveWarnings(
    confidenceScore,
    knowledgeGaps,
    contradictionWarnings,
  );

  if (
    !supportSummary &&
    confidenceScore == null &&
    !warnings.length &&
    !relatedEntities.length &&
    !evidenceItems.length &&
    !citationCoverageStatus
  ) {
    return null;
  }

  const coverageLabel =
    citationCoverageStatus === 'well_supported'
      ? 'Well supported'
      : citationCoverageStatus === 'partially_supported'
        ? 'Partially supported'
        : citationCoverageStatus === 'needs_verification'
          ? 'Needs verification'
          : null;

  return (
    <Card id='answer-proof-panel' variant='panel' shadow='none' tabIndex={-1}>
      <Heading size='sm' color='white' mb={3}>
        Answer Proof
      </Heading>

      <VStack gap={4} align='stretch'>
        <Box>
          <Text
            fontSize='xs'
            textTransform='uppercase'
            color='slate.400'
            mb={2}
          >
            Support Summary
          </Text>
          <HStack gap={2} wrap='wrap' mb={2}>
            <MetaChip label='support' value={confidence.label} />
            {intent ? <MetaChip label='mode' value={intent} /> : null}
            {coverageLabel ? (
              <MetaChip label='coverage' value={coverageLabel} />
            ) : null}
          </HStack>
          <Text fontSize='sm' color='slate.200'>
            {supportSummary ??
              'This answer is grounded in the cited evidence below.'}
          </Text>
          {(validCitationCount != null || rejectedCitationCount != null) && (
            <Text fontSize='xs' color='slate.400' mt={2}>
              {validCitationCount ?? 0} validated citation
              {(validCitationCount ?? 0) === 1 ? '' : 's'}
              {rejectedCitationCount
                ? `, ${rejectedCitationCount} rejected during validation`
                : ''}
            </Text>
          )}
        </Box>

        {warnings.length ? (
          <Box>
            <Text
              fontSize='xs'
              textTransform='uppercase'
              color='slate.400'
              mb={2}
            >
              Warnings
            </Text>
            <HStack gap={2} wrap='wrap'>
              {warnings.map((warning) => (
                <Badge
                  key={warning}
                  px={2}
                  py={1}
                  borderRadius='full'
                  bg='rgba(245, 158, 11, 0.16)'
                  color='yellow.300'
                  border='1px solid rgba(245, 158, 11, 0.28)'
                >
                  {warning}
                </Badge>
              ))}
            </HStack>
          </Box>
        ) : null}

        <Box>
          <Text
            fontSize='xs'
            textTransform='uppercase'
            color='slate.400'
            mb={2}
          >
            Evidence
          </Text>
          <VStack gap={3} align='stretch'>
            {evidenceItems.length ? (
              evidenceItems.map((source) => {
                const reviewLabel = reviewStatusLabel(source.review_status);
                return (
                  <Box
                    key={
                      source.evidence_span_id ??
                      `${source.document_id}-${source.page_number ?? 'legacy'}-${source.quote_text ?? source.snippet ?? 'evidence'}`
                    }
                    className='arctic-glass'
                    borderRadius='xl'
                    border='1px'
                    borderColor='glassBorder'
                    p={3}
                    cursor={onSourceClick ? 'pointer' : 'default'}
                    _hover={
                      onSourceClick
                        ? { borderColor: 'blue.400', opacity: 0.9 }
                        : undefined
                    }
                    transition='border-color 0.15s, opacity 0.15s'
                    onClick={() => onSourceClick?.(source)}
                  >
                    {reviewLabel ? (
                      <HStack mb={2} gap={2}>
                        <MetaChip label='review' value={reviewLabel} />
                        {source.location_label ? (
                          <MetaChip
                            label='location'
                            value={source.location_label}
                          />
                        ) : null}
                      </HStack>
                    ) : source.location_label ? (
                      <HStack mb={2} gap={2}>
                        <MetaChip
                          label='location'
                          value={source.location_label}
                        />
                      </HStack>
                    ) : null}
                    <Text fontSize='xs' color='slate.400' mb={1}>
                      {source.document_title}
                      {source.file_extension
                        ? ` • ${source.file_extension.toUpperCase()}`
                        : ''}
                    </Text>
                    <Text fontSize='sm' color='slate.200' lineClamp={5}>
                      {source.quote_text ?? source.snippet}
                    </Text>
                  </Box>
                );
              })
            ) : (
              <Text fontSize='sm' color='slate.400'>
                No evidence items were attached to this answer.
              </Text>
            )}
          </VStack>
        </Box>

        {relatedEntities.length ? (
          <Box>
            <Text
              fontSize='xs'
              textTransform='uppercase'
              color='slate.400'
              mb={2}
            >
              Related Entities
            </Text>
            <HStack gap={2} wrap='wrap'>
              {relatedEntities.slice(0, 6).map((entity) => (
                <MetaChip
                  key={entity.id}
                  label={entity.type}
                  value={entity.name}
                />
              ))}
            </HStack>
          </Box>
        ) : null}
      </VStack>
    </Card>
  );
}
