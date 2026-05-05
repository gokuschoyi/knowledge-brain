import { Box, Flex, Text } from '@chakra-ui/react';

export function MessageBubble({
  role,
  content,
  active = false,
  onClick,
}: {
  role: 'user' | 'assistant';
  content: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const isClickable = role === 'assistant' && !!onClick;

  return (
    <Flex justify={role === 'user' ? 'flex-end' : 'flex-start'}>
      <Box
        maxW='85%'
        borderRadius='2xl'
        px={4}
        py={2.5}
        fontSize='sm'
        shadow='sm'
        bg={role === 'user' ? 'brand.600' : 'slate.800'}
        color={role === 'user' ? 'white' : 'slate.100'}
        border='1px'
        borderColor={
          role === 'user' ? 'brand.500' : active ? 'brand.500' : 'slate.700'
        }
        borderTopLeftRadius={role === 'assistant' ? '0' : '2xl'}
        borderTopRightRadius={role === 'user' ? '0' : '2xl'}
        boxShadow={active ? '0 0 0 1px rgba(14, 165, 233, 0.55)' : 'sm'}
        cursor={isClickable ? 'pointer' : 'default'}
        transition='border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease'
        _hover={
          isClickable
            ? {
                borderColor: 'brand.500',
                boxShadow: '0 0 0 1px rgba(14, 165, 233, 0.45)',
              }
            : undefined
        }
        onClick={onClick}
      >
        <Text whiteSpace='pre-wrap' lineHeight='relaxed'>
          {content}
        </Text>
      </Box>
    </Flex>
  );
}
