import {
  Badge,
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Node } from 'reactflow';

interface NodeDetailsProps {
  selectedNode: Node;
}

const StatItem = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  <Box>
    <Text
      fontSize='xs'
      color='slate.500'
      textTransform='uppercase'
      fontWeight='bold'
    >
      {label}
    </Text>
    <Text fontSize='sm' color='slate.200' fontWeight='medium'>
      {value ?? '—'}
    </Text>
  </Box>
);

export function NodeDetails({ selectedNode }: NodeDetailsProps) {
  const data = selectedNode.data || {};
  const isEntity = data.originalType === 'entity';

  return (
    <Stack gap='5'>
      <Box>
        <HStack justify='space-between' align='start' mb='1'>
          <Heading size='sm' color='white'>
            {data.label || selectedNode.id}
          </Heading>
          <Badge variant='subtle' colorPalette={isEntity ? 'purple' : 'cyan'}>
            {isEntity
              ? data.entity_type || 'Entity'
              : data.source_type || 'Document'}
          </Badge>
        </HStack>
        {isEntity &&
          data.canonical_name &&
          data.canonical_name !== data.label && (
            <Text fontSize='xs' color='slate.500'>
              aka {data.canonical_name}
            </Text>
          )}
      </Box>

      <Box>
        <Heading
          size='xs'
          textTransform='uppercase'
          color='slate.500'
          mb='2'
          letterSpacing='wider'
        >
          {isEntity ? 'Description' : 'Summary'}
        </Heading>
        <Text
          fontSize='sm'
          color='slate.300'
          lineHeight='tall'
          maxH='200px'
          overflowY='auto'
          css={{
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--chakra-colors-slate-700)',
              borderRadius: '4px',
            },
          }}
        >
          {isEntity
            ? data.description || 'No description available for this entity.'
            : data.summary || 'No summary available for this document.'}
        </Text>
      </Box>

      <SimpleGrid columns={2} gap='4' pt='2'>
        <StatItem
          label={isEntity ? 'Confidence' : 'Quality Score'}
          value={
            isEntity
              ? typeof data.confidence === 'number'
                ? data.confidence.toFixed(2)
                : data.confidence
              : typeof data.quality_score === 'number'
                ? data.quality_score.toFixed(2)
                : data.quality_score
          }
        />
        <StatItem
          label={isEntity ? 'Mentions' : 'Chunks'}
          value={isEntity ? data.mention_count : data.chunks_count}
        />
      </SimpleGrid>

      {isEntity &&
        data.aliases &&
        Array.isArray(data.aliases) &&
        data.aliases.length > 0 && (
          <Box pt='2'>
            <Heading
              size='xs'
              textTransform='uppercase'
              color='slate.500'
              mb='2'
              letterSpacing='wider'
            >
              Aliases
            </Heading>
            <HStack wrap='wrap' gap='2'>
              {data.aliases.map((alias: string, idx: number) => (
                <Badge
                  key={idx}
                  size='sm'
                  variant='outline'
                  colorPalette='slate'
                  px='2'
                  borderRadius='full'
                >
                  {alias}
                </Badge>
              ))}
            </HStack>
          </Box>
        )}

      {!isEntity &&
        data.tags &&
        Array.isArray(data.tags) &&
        data.tags.length > 0 && (
          <Box pt='2'>
            <Heading
              size='xs'
              textTransform='uppercase'
              color='slate.500'
              mb='2'
              letterSpacing='wider'
            >
              Tags
            </Heading>
            <HStack wrap='wrap' gap='2'>
              {data.tags.map((tag: string, idx: number) => (
                <Badge
                  key={idx}
                  size='sm'
                  variant='outline'
                  colorPalette='cyan'
                  px='2'
                >
                  {tag}
                </Badge>
              ))}
            </HStack>
          </Box>
        )}
    </Stack>
  );
}
