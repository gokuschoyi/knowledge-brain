import { Box, Flex, Text } from '@chakra-ui/react';

export function MessageBubble({
  role,
  content,
}: {
  role: 'user' | 'assistant';
  content: string;
}) {
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
        borderColor={role === 'user' ? 'brand.500' : 'slate.700'}
        borderTopLeftRadius={role === 'assistant' ? '0' : '2xl'}
        borderTopRightRadius={role === 'user' ? '0' : '2xl'}
      >
        <Text whiteSpace='pre-wrap' lineHeight='relaxed'>
          {content}
        </Text>
      </Box>
    </Flex>
  );
}
