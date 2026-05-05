import { Box, Heading, Text } from '@chakra-ui/react';

export function Topbar() {
  return (
    <Box
      as='header'
      display='flex'
      alignItems='center'
      justifyContent='space-between'
      borderBottom='1px'
      borderColor='slate.800'
      bg='slate.950'
      px={6}
      py={4}
      backdropFilter='blur(8px)'
    >
      <Box>
        <Heading size='md' color='white' fontWeight='semibold'>
          Knowledge Brain
        </Heading>
        <Text fontSize='sm' color='slate.400'>
          Ingest, structure, retrieve, repair.
        </Text>
      </Box>
    </Box>
  );
}
