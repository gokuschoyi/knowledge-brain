import { Link as RouterLink } from 'react-router-dom';
import { ArrowUpRight, RotateCcw, Trash2 } from 'lucide-react';
import {
  Box,
  Flex,
  HStack,
  VStack,
  Link as ChakraLink,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { Document } from '../../api/documents';
import { Button } from '../common/Button';
import { MetaChip } from '../common/MetaChip';
import { StatusPill } from '../common/StatusPill';

const statusAccent: Record<string, string> = {
  completed: 'cyan.400',
  failed: 'danger.400',
  pending: 'warning.400',
  processing: 'indigo.400',
};

export function DocumentItem({
  document,
  onRetry,
  onDelete,
  busy,
}: {
  document: Document;
  onRetry?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  return (
    <Flex
      className='arctic-glass ui-hover'
      borderRadius='2xl'
      overflow='hidden'
      flexShrink='0'
    >
      <Box
        w='1.5'
        bg={statusAccent[document.status] ?? 'fgSubtle'}
        boxShadow={`0 0 24px var(--chakra-colors-${(statusAccent[document.status] ?? 'fgSubtle').replace('.', '-')})`}
      />
      <Stack gap='4' p='5' flex='1'>
        <Flex
          flexDirection={'column'}
          justify='space-between'
          align='flex-start'
          gap='4'
        >
          <HStack
            gap='2'
            flex='1'
            justify='space-between'
            align='flex-start'
            w={'full'}
          >
            <VStack gap='2' wrap='wrap' alignItems={'flex-start'}>
              <Box display='flex' gap='2' alignItems='center' flexWrap='wrap'>
                <MetaChip
                  label='source'
                  value={document.source_label ?? document.source_type}
                />
                <MetaChip
                  label='authority'
                  value={
                    document.source_authority_label ?? document.source_authority
                  }
                />
              </Box>
              {document.brain_name ? (
                <MetaChip label='brain' value={document.brain_name} />
              ) : null}
            </VStack>

            <Stack align='flex-end' gap='2'>
              <MetaChip
                label='provider'
                value={document.llm_provider || 'unknown'}
              />
              <MetaChip label='model' value={document.llm_model || 'unknown'} />
            </Stack>
          </HStack>

          <VStack gap='2' align='flex-start' w='full'>
            <HStack
              w='full'
              justify='space-between'
              align='flex-start'
              gap='3'
              flexWrap='wrap'
            >
              <ChakraLink asChild _hover={{ textDecoration: 'none' }}>
                <RouterLink to={`/documents/${document.id}`}>
                  <Text color='white' fontSize='lg' fontWeight='700'>
                    {document.title}
                  </Text>
                </RouterLink>
              </ChakraLink>
              <StatusPill status={document.status}>
                {document.status_label ?? document.status}
              </StatusPill>
            </HStack>

            <Text fontSize='sm' color='fgMuted' lineClamp={2}>
              {document.summary || 'No summary generated yet.'}
            </Text>
          </VStack>
        </Flex>

        <Flex
          justify='space-between'
          align={{ base: 'flex-start', md: 'center' }}
          gap='4'
          wrap='wrap'
        >
          <HStack gap='3' color='fgSubtle' fontSize='xs'>
            <Text fontFamily='mono'>chunks {document.chunks_count}</Text>
            <Text fontFamily='mono'>
              activity{' '}
              {new Date(
                document.latest_activity_at ?? document.updated_at,
              ).toLocaleDateString()}
            </Text>
          </HStack>

          <HStack gap='2'>
            {document.status === 'failed' && onRetry ? (
              <Button
                size='sm'
                variant='outline'
                onClick={onRetry}
                loading={busy}
              >
                <RotateCcw size={14} />
                Retry
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                size='sm'
                variant='danger'
                onClick={onDelete}
                loading={busy && document.status !== 'failed'}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            ) : null}
            <Button asChild size='sm' variant='outline'>
              <RouterLink to={`/documents/${document.id}`}>
                <ArrowUpRight size={14} />
                Details
              </RouterLink>
            </Button>
          </HStack>
        </Flex>

        {document.error_message ? (
          <Text fontSize='sm' color='danger.400'>
            {document.error_message}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}
