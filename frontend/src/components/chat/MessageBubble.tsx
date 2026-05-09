import { memo } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const MessageBubble = memo(
  ({
    role,
    content,
    active = false,
    confidenceScore,
    onClick,
  }: {
    role: 'user' | 'assistant';
    content: string;
    active?: boolean;
    confidenceScore?: number | null;
    onClick?: () => void;
  }) => {
    const isClickable = role === 'assistant' && !!onClick;
    const isLowConfidence =
      role === 'assistant' &&
      confidenceScore != null &&
      confidenceScore < LOW_CONFIDENCE_THRESHOLD;

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
          <MarkdownRenderer content={content} />
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
