import { Box, Flex } from '@chakra-ui/react';

import type { DocumentEntity } from '../../api/types';

type Props = {
  entity: DocumentEntity;
};

export function EntityListItem({ entity }: Props) {
  return (
    <Flex
      p='2'
      bg='slate.900/50'
      borderRadius='md'
      align='center'
      fontSize='sm'
      color='slate.300'
    >
      <Box w='2' h='2' borderRadius='full' bg='brand.400' mr='3' />
      {entity.name}
    </Flex>
  );
}
