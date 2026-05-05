import { Heading, Text, Box, Code } from '@chakra-ui/react';
import { Card } from '../common/Card';

export function NodeDetailsPanel({ node }: { node: any | null }) {
  if (!node) {
    return (
      <Card>
        <Heading size='sm' color='white'>
          Node details
        </Heading>
        <Text mt={2} fontSize='sm' color='slate.400'>
          Select a node in the graph to inspect its metadata.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <Heading size='sm' color='white' mb={3}>
        {node.label}
      </Heading>
      <Box
        mt={3}
        p={3}
        bg='slate.900'
        borderRadius='md'
        overflow='auto'
        maxH='400px'
      >
        <Code
          variant='plain'
          display='block'
          whiteSpace='pre-wrap'
          fontSize='xs'
          color='slate.300'
        >
          {JSON.stringify(node.data, null, 2)}
        </Code>
      </Box>
    </Card>
  );
}
