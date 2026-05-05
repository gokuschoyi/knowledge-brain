import { Box, Heading, HStack, Text } from '@chakra-ui/react';
import { Card } from '../common/Card';

export function GraphLegend({ activeBrainName }: { activeBrainName?: string }) {
  return (
    <Card display={'flex'} flexDirection={'row'} gap={6} alignItems={'center'}>
      <Box display='flex' flexDirection='column' gap={0}>
        <Heading size='xs' color='white' mb={1}>
          Legend
        </Heading>
        <Text fontSize='xs' color='slate.500'>
          {activeBrainName ? activeBrainName : 'Choose a brain'}
        </Text>
      </Box>
      <HStack gap={4} wrap='wrap' fontSize='xs' color='slate.300'>
        <HStack gap='2'>
          <Box
            w='3'
            h='3'
            borderRadius='full'
            border='1px solid #0891b2'
            bg='linear-gradient(180deg, rgba(8, 145, 178, 0.24) 0%, rgba(12, 74, 110, 0.34) 100%)'
            boxShadow='0 4px 12px rgba(8, 145, 178, 0.18)'
          />
          <Text>Docs = sources</Text>
        </HStack>
        <HStack gap='2'>
          <Box
            w='3'
            h='3'
            borderRadius='full'
            border='1px solid #7c3aed'
            bg='linear-gradient(180deg, rgba(109, 40, 217, 0.22) 0%, rgba(49, 46, 129, 0.3) 100%)'
            boxShadow='0 4px 12px rgba(76, 29, 149, 0.2)'
          />
          <Text>Entities = concepts</Text>
        </HStack>
        <HStack gap='2'>
          <Box w='5' h='0' borderTop='2px solid #64748b' position='relative'>
            <Box
              position='absolute'
              right='-1px'
              top='-4px'
              w='0'
              h='0'
              borderTop='4px solid transparent'
              borderBottom='4px solid transparent'
              borderLeft='6px solid #64748b'
            />
          </Box>
          <Text>Edges = links</Text>
        </HStack>
      </HStack>
    </Card>
  );
}
