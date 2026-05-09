import { Badge, Box, HStack, Text } from '@chakra-ui/react';

import type { DocumentRelationship } from '../../api/types';

type Props = {
  relationship: DocumentRelationship;
};

export function RelationshipItem({ relationship }: Props) {
  return (
    <Box
      p='2'
      bg='slate.900/50'
      borderRadius='md'
      fontSize='sm'
      color='slate.300'
    >
      <HStack wrap='wrap'>
        <Text fontWeight='bold' color='white'>
          {relationship.source_name}
        </Text>
        <Badge size='sm' variant='outline' colorPalette='orange'>
          {relationship.relationship_type}
        </Badge>
        <Text fontWeight='bold' color='white'>
          {relationship.target_name}
        </Text>
      </HStack>
    </Box>
  );
}
